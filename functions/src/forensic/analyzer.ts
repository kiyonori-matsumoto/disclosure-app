import AdmZip from "adm-zip";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { extractQualitativeSections, extractTdnetQualitativeHtml } from "./extractor";
import {
  assessQuantitativeRisk,
  extractFinancialMetricsFromZip,
} from "./financial_metrics_extractor";
import { detectFinancialAnomaly } from "./schemas/financial_anomaly";
import { detectQualitativeExcuses } from "./schemas/qualitative_excuses";
import { CauseTag, ForensicResult, RedFlagType, RiskLevel, ToneTag } from "./types";

export interface AnalyzerOptions {
  apiKey?: string;
  client?: TypeSafeClient;
}

export class ForensicAnalyzer {
  private client: TypeSafeClient;

  constructor(options: AnalyzerOptions = {}) {
    this.client =
      options.client ||
      new TypeSafeClient(
        options.apiKey
          ? { apiKey: options.apiKey }
          : process.env.TYPESAFE_API_KEY
          ? { apiKey: process.env.TYPESAFE_API_KEY }
          : undefined
      );
  }

  /**
   * ZIP バッファを解析し、ForensicResult を生成する
   * @param zipBuffer ZIP ファイルのバイナリ
   * @param isTdnet TDnet の開示 ZIP かどうか（省略時はファイル名や構造から自動判定）
   */
  async analyzeZip(zipBuffer: Buffer, isTdnet?: boolean): Promise<ForensicResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // 1. 主要財務数値の抽出と定量判定
    const metrics = extractFinancialMetricsFromZip(zipBuffer);
    const quantitative = assessQuantitativeRisk(metrics);

    // 2. 定性セクションの抽出
    let mdaText = "";
    let riskText = "";
    let footnoteText = "";

    const isTdnetDoc =
      isTdnet !== undefined
        ? isTdnet
        : entries.some((e) => e.entryName.includes("XBRLData"));

    if (isTdnetDoc) {
      // TDnet の場合: qualitative.htm または Attachment 内の iXBRL を探索
      for (const entry of entries) {
        const name = entry.entryName;
        if (name.includes("qualitative.htm")) {
          const content = entry.getData().toString("utf-8");
          const tdnetExtracted = extractTdnetQualitativeHtml(content);
          mdaText = tdnetExtracted.mdaText;
          riskText = tdnetExtracted.riskText;
        } else if (name.endsWith(".htm") && name.includes("Attachment")) {
          const content = entry.getData().toString("utf-8");
          const sections = extractQualitativeSections(content);
          if (sections.has("BusinessRisksTextBlock")) {
            riskText += "\n" + sections.get("BusinessRisksTextBlock")!.text;
          }
          if (sections.has("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")) {
            footnoteText += "\n" + sections.get("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")!.text;
          }
        }
      }
    } else {
      // EDINET の場合: PublicDoc/*.htm を探索
      for (const entry of entries) {
        if (!entry.entryName.includes("PublicDoc") || !entry.entryName.endsWith(".htm")) continue;
        const content = entry.getData().toString("utf-8");
        const sections = extractQualitativeSections(content);

        if (sections.has("ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock")) {
          mdaText += "\n" + sections.get("ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock")!.text;
        }
        if (sections.has("BusinessRisksTextBlock")) {
          riskText += "\n" + sections.get("BusinessRisksTextBlock")!.text;
        }
        if (sections.has("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")) {
          footnoteText += "\n" + sections.get("EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock")!.text;
        }
        if (sections.has("SignificantSubsequentEventsTextBlock")) {
          footnoteText += "\n" + sections.get("SignificantSubsequentEventsTextBlock")!.text;
        }
      }
    }

    // 3. Jev System One による定性・注記・経営トーン解析
    const [financialAnomaly, excuses] = await Promise.all([
      detectFinancialAnomaly(this.client, footnoteText, metrics),
      detectQualitativeExcuses(this.client, mdaText, riskText, metrics),
    ]);

    // 4. 定量レッドフラグと定性レッドフラグの結合（重複除去）
    const allRedFlagsSet = new Set<RedFlagType>([
      ...quantitative.detectedRedFlags,
      ...financialAnomaly.detectedRedFlags,
    ]);
    const redFlags = Array.from(allRedFlagsSet);

    // 5. タグと深刻度の集約
    const allTags: (RedFlagType | ToneTag)[] = [...redFlags, ...excuses.toneTags];
    const causes: CauseTag[] = excuses.causeTags;

    let overallRisk: RiskLevel = "normal";
    if (financialAnomaly.riskLevel === "critical" || redFlags.includes("going_concern") || redFlags.includes("covenant_breach")) {
      overallRisk = "critical";
    } else if (
      financialAnomaly.riskLevel === "warning" ||
      redFlags.length > 0 ||
      excuses.toneTags.length > 0
    ) {
      overallRisk = "warning";
    }

    return {
      version: 1,
      analyzedAt: Math.floor(Date.now() / 1000),
      riskLevel: overallRisk,
      tags: allTags,
      causes,
      metrics,
      details: {
        blameAttribution: excuses.blameAttribution,
        unfoundedOptimism: excuses.unfoundedOptimism,
        hasNegativeFactors: excuses.hasNegativeFactors,
      },
    };
  }
}
