import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import { KeyFinancialMetrics, RedFlagType } from "./types";

export interface QuantitativeAssessment {
  metrics: KeyFinancialMetrics;
  detectedRedFlags: RedFlagType[];
  warnings: string[];
}

/**
 * ZIP バッファまたはファイルから主要財務数値を自動抽出
 * EDINET (PublicDoc) および TDnet (XBRLData) の両方に対応
 */
export function extractFinancialMetricsFromZip(zipBufferOrPath: Buffer | string): KeyFinancialMetrics {
  const zip = typeof zipBufferOrPath === "string" ? new AdmZip(zipBufferOrPath) : new AdmZip(zipBufferOrPath);
  const entries = zip.getEntries();

  const rawItems: Record<string, number[]> = {};

  for (const entry of entries) {
    const entryName = entry.entryName;
    const isEdinetDoc = entryName.includes("PublicDoc") && entryName.endsWith(".htm");
    const isTdnetDoc = entryName.includes("XBRLData") && entryName.endsWith(".htm");

    if (!isEdinetDoc && !isTdnetDoc) continue;

    const content = entry.getData().toString("utf-8");
    if (!content.includes("nonFraction") && !content.includes("nonfraction")) continue;

    const $ = cheerio.load(content);
    $("ix\\:nonfraction, nonfraction").each((_, el) => {
      const name = $(el).attr("name") || "";
      const text = $(el).text().replace(/[\n\r\s,]/g, "");
      const sign = $(el).attr("sign");
      const scaleStr = $(el).attr("scale");
      let num = parseFloat(text);

      if (!isNaN(num)) {
        if (sign === "-") {
          num = -Math.abs(num);
        }

        // scale: "6" (百万円) の場合は千円 (*1000) に正規化、"3" (千円) はそのまま、"0" (円) は千円単位 (/1000)
        if (scaleStr === "6") {
          num = num * 1000;
        } else if (scaleStr === "0") {
          num = Math.round(num / 1000);
        }

        if (!rawItems[name]) {
          rawItems[name] = [];
        }
        rawItems[name].push(num);
      }
    });
  }

  // 最新値（配列の末尾）の探索ヘルパー
  const findLatest = (patterns: string[]): number | undefined => {
    for (const pattern of patterns) {
      for (const key of Object.keys(rawItems)) {
        if (key.includes(pattern)) {
          const values = rawItems[key];
          if (values && values.length > 0) {
            return values[values.length - 1];
          }
        }
      }
    }
    return undefined;
  };

  // EDINET / TDnet のタグパターン
  const revenue = findLatest([
    "NetSalesSummaryOfBusinessResults",
    "OperatingRevenues",
    "NetSales",
    "OperatingRevenue",
  ]);

  const operatingIncome = findLatest([
    "OperatingIncome",
    "OperatingProfitLoss",
    "OperatingProfit",
  ]);

  const netIncome = findLatest([
    "ProfitLossAttributableToOwnersOfParent",
    "NetIncomeLossSummaryOfBusinessResults",
    "NetIncomeLoss",
    "ProfitLoss",
  ]);

  const operatingCashFlow = findLatest([
    "NetCashProvidedByUsedInOperatingActivities",
    "CashFlowsFromUsedInOperatingActivities",
    "OperatingCashFlow",
  ]);

  const payoutRatio = findLatest(["PayoutRatio"]);

  const totalAssets = findLatest([
    "TotalAssetsSummaryOfBusinessResults",
    "TotalAssets",
  ]);

  const result: KeyFinancialMetrics = { unit: "千円" };

  if (revenue !== undefined) result.revenue = revenue;
  if (operatingIncome !== undefined) result.operatingIncome = operatingIncome;
  if (netIncome !== undefined) result.netIncome = netIncome;
  if (operatingCashFlow !== undefined) result.operatingCashFlow = operatingCashFlow;
  if (payoutRatio !== undefined) result.payoutRatio = payoutRatio;
  if (totalAssets !== undefined) result.totalAssets = totalAssets;

  return result;
}

/**
 * 財務数値から定量的リスク（営業CFマイナス、配当性向100%超等）を判定
 */
export function assessQuantitativeRisk(metrics: KeyFinancialMetrics): QuantitativeAssessment {
  const detectedRedFlags: RedFlagType[] = [];
  const warnings: string[] = [];

  // 1. 営業キャッシュ・フローのマイナス判定
  if (metrics.operatingCashFlow !== undefined && metrics.operatingCashFlow < 0) {
    detectedRedFlags.push("negative_operating_cf");
    warnings.push(
      `営業活動によるキャッシュ・フローがマイナス（${metrics.operatingCashFlow.toLocaleString()}千円）`
    );
  }

  // 2. 配当性向 100% 超（利益超過分配・無理な配当維持）
  if (metrics.payoutRatio !== undefined && metrics.payoutRatio > 100.0) {
    detectedRedFlags.push("unsustainable_payout");
    warnings.push(`配当性向が ${metrics.payoutRatio.toFixed(1)}%`);
  }

  return {
    metrics,
    detectedRedFlags,
    warnings,
  };
}
