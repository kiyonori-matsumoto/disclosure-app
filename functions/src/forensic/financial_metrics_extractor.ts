import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import {
  AccountingStandard,
  FiscalPeriodType,
  FinancialSnapshot,
  KeyFinancialMetrics,
} from "./types";
import { QuantitativeAssessment, QuantitativeForensicEngine } from "./rules";

export { QuantitativeAssessment };

export interface ForensicDocumentMetadata {
  companyName?: string;
  title?: string;
  code?: string;
}

const FINANCIAL_COMPANY_KEYWORDS = [
  "銀行",
  "証券",
  "保険",
  "フィナンシャル",
  "信託",
  "リース",
  "アセットマネジメント",
  "インベストメント",
  "キャピタル",
];

const FINANCIAL_TITLE_KEYWORDS = [
  "投資信託",
  "受益証券",
  "投資法人",
  "リート",
];

interface RawTagEntry {
  name: string;
  contextRef: string;
  value: number;
}

/**
 * XBRL タグ定義辞書
 */
export const XBRL_TAG_DICTIONARY = {
  revenue: [
    "RevenueIFRS",
    "SalesIFRS",
    "NetSales",
    "OperatingRevenue",
    "Revenue",
    "NetSalesSummaryOfBusinessResults",
    "OrdinaryIncomeBNK",
    "OrdinaryIncomeSummaryOfBusinessResults",
    "OperatingRevenuesSEC",
    "OrdinaryIncomeINS",
    "OperatingRevenues",
  ],
  operatingIncome: [
    "OperatingProfitLossIFRS",
    "OperatingIncomeIFRS",
    "OperatingIncome",
    "OperatingProfitLoss",
    "OperatingProfit",
  ],
  netIncome: [
    "ProfitLossAttributableToOwnersOfParentIFRS",
    "ProfitAttributableToOwnersOfParentIFRS",
    "ProfitLossAttributableToOwnersOfParent",
    "ProfitAttributableToOwnersOfParent",
    "NetIncomeLossSummaryOfBusinessResults",
    "NetIncomeLoss",
    "ProfitLoss",
  ],
  operatingCashFlow: [
    "NetCashProvidedByUsedInOperatingActivitiesIFRS",
    "NetCashProvidedByUsedInOperatingActivities",
    "CashFlowsFromUsedInOperatingActivities",
    "OperatingCashFlow",
  ],
  payoutRatio: ["PayoutRatioIFRS", "PayoutRatio"],
  totalAssets: [
    "AssetsIFRS",
    "TotalAssetsIFRS",
    "TotalAssetsSummaryOfBusinessResults",
    "TotalAssets",
    "Assets",
  ],
  tradeReceivables: {
    totalTags: [
      "TradeAndOtherReceivablesCAIFRS",
      "TradeAndOtherCurrentReceivablesIFRS",
      "TradeReceivablesIFRS",
      "NotesAndAccountsReceivableTradeAndContractAssets", // J-GAAP 収益認識基準後
      "NotesAndAccountsReceivableTrade",                  // J-GAAP 旧基準・一般
      "TradeAndOtherCurrentReceivables",                  // IFRS 一般
      "TradeReceivables",                                 // IFRS
      "AccountsReceivableNetCurrent",                     // US-GAAP
      "ReceivablesNetCurrent",                            // US-GAAP
      "AccountsReceivableTrade",                          // 売掛金単独一括
    ],
    componentTags: [
      "NotesReceivableTrade",
      "AccountsReceivableTrade",
      "ContractAssets",
      "ElectronicallyRecordedMonetaryClaimsOperating",
    ],
  },
  inventories: {
    totalTags: [
      "InventoriesCAIFRS",
      "InventoriesIFRS",
      "Inventories",                                      // J-GAAP一括 / IFRS
      "InventoryNet",                                     // US-GAAP
    ],
    componentTags: [
      "MerchandiseAndFinishedGoods",
      "Merchandise",
      "FinishedGoods",
      "WorkInProcess",
      "RawMaterialsAndSupplies",
      "RealEstateForSale",
      "RealEstateForSaleInProcess",
    ],
  },
  cashAndDeposits: [
    "CashAndCashEquivalentsIFRS",
    "CashAndDeposits",
    "CashAndDueFromBanksAssetsBNK",
    "CashAndDueFromBanksBNK",
    "CashAndDueFromBanks",
    "CashAndCashEquivalents",
    "CashAndCashEquivalentsAtCarryingValue",
  ],
  currentAssets: ["CurrentAssetsIFRS", "CurrentAssets", "AssetsCurrent"],
  propertyPlantAndEquipment: ["PropertyPlantAndEquipmentIFRS", "PropertyPlantAndEquipment", "PropertyPlantAndEquipmentNet"],
  currentLiabilities: ["TotalCurrentLiabilitiesIFRS", "CurrentLiabilitiesIFRS", "CurrentLiabilities", "LiabilitiesCurrent"],
  netAssets: [
    "EquityAttributableToOwnersOfParentIFRS",
    "TotalEquityIFRS",
    "EquityIFRS",
    "NetAssets",
    "EquityAttributableToOwnersOfParent",
    "Equity",
    "StockholdersEquity",
  ],
  retainedEarnings: [
    "RetainedEarningsIFRS",
    "RetainedEarnings",
    "RetainedEarningsAccumulatedDeficit",
  ],
  investingCashFlow: [
    "NetCashProvidedByUsedInInvestingActivitiesIFRS",
    "NetCashProvidedByUsedInInvestingActivities",
    "NetCashProvidedByUsedInInvestmentActivities",
    "CashFlowsFromUsedInInvestingActivities",
  ],
  goodwill: ["GoodwillIFRS", "Goodwill", "ConsolidatedGoodwill"],
};

function isCurrentContext(contextRef: string): boolean {
  const lower = contextRef.toLowerCase();
  if (
    lower.includes("prior") ||
    lower.includes("previous") ||
    lower.includes("next") ||
    lower.includes("forecast") ||
    lower.includes("lower") ||
    lower.includes("upper")
  ) {
    return false;
  }
  return (
    lower.includes("current") ||
    lower.includes("filingdate") ||
    lower.includes("instant") ||
    lower.includes("duration")
  );
}

function isPriorContext(contextRef: string): boolean {
  const lower = contextRef.toLowerCase();
  return lower.includes("prior1") || lower.includes("prior") || lower.includes("previous");
}

/**
 * ZIP バッファまたはファイルから主要財務数値を自動抽出（当期・前期ペア対応）
 * EDINET (PublicDoc) および TDnet (XBRLData) の両方に対応
 */
export function extractFinancialMetricsFromZip(
  zipBufferOrPath: Buffer | string,
  meta?: ForensicDocumentMetadata
): KeyFinancialMetrics {
  const zip = typeof zipBufferOrPath === "string" ? new AdmZip(zipBufferOrPath) : new AdmZip(zipBufferOrPath);
  const entries = zip.getEntries();

  const currentEntries: RawTagEntry[] = [];
  const priorEntries: RawTagEntry[] = [];
  const allEntriesByTag: Record<string, number[]> = {};

  let detectedStandard: AccountingStandard = "J-GAAP";
  let detectedPeriod: FiscalPeriodType = "FY";
  let isFinancial = false;

  // メタデータ（会社名・タイトル・証券コード）による金融・リース・投資信託判定
  if (meta) {
    if (meta.companyName) {
      if (FINANCIAL_COMPANY_KEYWORDS.some((kw) => meta.companyName!.includes(kw))) {
        isFinancial = true;
      }
    }
    if (meta.title) {
      if (FINANCIAL_TITLE_KEYWORDS.some((kw) => meta.title!.includes(kw))) {
        isFinancial = true;
      }
    }
    if (meta.code) {
      const numCode = parseInt(meta.code.slice(0, 4), 10);
      // 東証33業種の金融関連（8300-8799: 銀行・証券・保険・その他金融）
      if (!isNaN(numCode) && numCode >= 8300 && numCode <= 8799) {
        isFinancial = true;
      }
    }
  }

  for (const entry of entries) {
    const entryName = entry.entryName;
    const isEdinetDoc = entryName.includes("PublicDoc") && entryName.endsWith(".htm");
    const isTdnetDoc = entryName.includes("XBRLData") && entryName.endsWith(".htm");

    if (!isEdinetDoc && !isTdnetDoc) continue;

    // 四半期判定
    const lowerName = entryName.toLowerCase();
    if (lowerName.includes("q1") || lowerName.includes("1q")) detectedPeriod = "Q1";
    else if (lowerName.includes("q2") || lowerName.includes("2q")) detectedPeriod = "Q2";
    else if (lowerName.includes("q3") || lowerName.includes("3q")) detectedPeriod = "Q3";

    const content = entry.getData().toString("utf-8");
    if (!content.includes("nonFraction") && !content.includes("nonfraction")) continue;

    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes("jpigp_cor") ||
      lowerContent.includes("taxonomy/jpigp") ||
      lowerContent.includes("revenueifrs") ||
      lowerName.includes("ifsm") ||
      lowerName.includes("iffr")
    ) {
      detectedStandard = "IFRS";
    } else if (
      lowerContent.includes("jpusp_cor") ||
      lowerContent.includes("taxonomy/jpusp") ||
      lowerContent.includes("us-gaap:")
    ) {
      detectedStandard = "US-GAAP";
    }

    if (
      content.includes("OrdinaryIncomeBNK") ||
      content.includes("OperatingRevenuesSEC") ||
      content.includes("OperatingRevenueSEC") ||
      content.includes("BrokerageCommission") ||
      content.includes("UnderwritingIncomeINS") ||
      content.includes("LeaseInvestmentAssets") ||
      content.includes("InvestmentAssets")
    ) {
      isFinancial = true;
    }

    const $ = cheerio.load(content);
    $("ix\\:nonfraction, nonfraction").each((_, el) => {
      const name = $(el).attr("name") || "";
      const contextRef = $(el).attr("contextref") || $(el).attr("contextRef") || "";
      const text = $(el).text().replace(/[\n\r\s,]/g, "");
      const sign = $(el).attr("sign");
      const scaleStr = $(el).attr("scale");
      let num = parseFloat(text);

      // 四半期コンテキスト判定（当期の累計実績コンテキストから判定）
      if (contextRef.includes("CurrentAccumulatedQ3") || contextRef.includes("CurrentQuarter3")) {
        detectedPeriod = "Q3";
      } else if (
        contextRef.includes("CurrentAccumulatedQ2") ||
        contextRef.includes("CurrentQuarter2") ||
        contextRef.includes("CurrentInterim") ||
        contextRef === "InterimDuration" ||
        contextRef === "InterimInstant"
      ) {
        if (detectedPeriod !== "Q3") detectedPeriod = "Q2";
      } else if (contextRef.includes("CurrentAccumulatedQ1") || contextRef.includes("CurrentQuarter1")) {
        if (detectedPeriod === "FY") detectedPeriod = "Q1";
      }

      if (!isNaN(num)) {
        if (sign === "-") {
          num = -Math.abs(num);
        }

        // 1株当たり指標 (PerShare) や比率指標 (Ratio, Rate) は単位正規化（/1000）の対象外
        const isPerShareOrRatio = name.includes("PerShare") || name.includes("Ratio") || name.includes("Rate");
        if (!isPerShareOrRatio) {
          // scale: "6" (百万円) の場合は千円 (*1000) に正規化、"3" (千円) はそのまま、"0" (円) は千円単位 (/1000)
          if (scaleStr === "6") {
            num = num * 1000;
          } else if (scaleStr === "0") {
            num = Math.round(num / 1000);
          }
        }

        const tagItem: RawTagEntry = { name, contextRef, value: num };

        if (!allEntriesByTag[name]) {
          allEntriesByTag[name] = [];
        }
        allEntriesByTag[name].push(num);

        if (isPriorContext(contextRef)) {
          priorEntries.push(tagItem);
        } else if (isCurrentContext(contextRef)) {
          currentEntries.push(tagItem);
        }
      }
    });
  }

  // タグ探索ヘルパー（単一またはフォールバック）
  const findValue = (
    patterns: string[],
    contextList: RawTagEntry[],
    fallbackAll: Record<string, number[]>,
    isPriorFallback = false,
    exactMatchOnly = false,
    preferContextKeyword?: string
  ): number | undefined => {
    // 連結決算企業では連結コンテキスト（!NonConsolidated）を最優先し、単体企業では全体から探索
    const consolidatedList = contextList.filter((item) => !item.contextRef.includes("NonConsolidated"));
    const listsToSearch = consolidatedList.length > 0 ? [consolidatedList, contextList] : [contextList];

    for (const targetList of listsToSearch) {
      // 1-A. 完全一致かつ優先コンテキスト（前年同四半期・前中間期など）
      if (preferContextKeyword) {
        for (const pattern of patterns) {
          for (let i = targetList.length - 1; i >= 0; i--) {
            const item = targetList[i];
            if (
              (item.name.endsWith(":" + pattern) || item.name === pattern) &&
              item.contextRef.includes(preferContextKeyword)
            ) {
              return item.value;
            }
          }
        }
      }

      // 1-B. 完全一致（ローカル名またはフル名）
      for (const pattern of patterns) {
        for (let i = targetList.length - 1; i >= 0; i--) {
          const item = targetList[i];
          if (item.name.endsWith(":" + pattern) || item.name === pattern) {
            return item.value;
          }
        }
      }

      if (!exactMatchOnly) {
        // 2-A. 部分一致かつ優先コンテキスト
        if (preferContextKeyword) {
          for (const pattern of patterns) {
            for (let i = targetList.length - 1; i >= 0; i--) {
              const item = targetList[i];
              if (item.name.includes(pattern) && item.contextRef.includes(preferContextKeyword)) {
                if (pattern.includes("OperatingIncome") && item.name.includes("NonOperating")) continue;
                if (item.name.includes("DecreaseIncreaseIn") || item.name.includes("AllowanceFor")) continue;
                if (item.name.includes("Unearned") || item.name.includes("Deferred")) continue;
                return item.value;
              }
            }
          }
        }

        // 2-B. 部分一致（完全一致で見つからなかった場合のみ）
        for (const pattern of patterns) {
          for (let i = targetList.length - 1; i >= 0; i--) {
            const item = targetList[i];
            if (item.name.includes(pattern)) {
              if (pattern.includes("OperatingIncome") && item.name.includes("NonOperating")) continue;
              // CF の増減額タグや引当金タグ、前受収益（負債）の誤爆防止
              if (item.name.includes("DecreaseIncreaseIn") || item.name.includes("AllowanceFor")) continue;
              if (item.name.includes("Unearned") || item.name.includes("Deferred")) continue;
              return item.value;
            }
          }
        }
      }
    }

    // 3. allEntriesByTag からのフォールバック（完全一致優先）
    for (const pattern of patterns) {
      for (const key of Object.keys(fallbackAll)) {
        if (key.endsWith(":" + pattern) || key === pattern) {
          const list = fallbackAll[key];
          if (list && list.length > 0) {
            if (isPriorFallback) {
              return list.length >= 2 ? list[list.length - 2] : undefined;
            }
            return list[list.length - 1];
          }
        }
      }
    }

    if (!exactMatchOnly) {
      // 4. allEntriesByTag からの部分一致
      for (const pattern of patterns) {
        for (const key of Object.keys(fallbackAll)) {
          if (key.includes(pattern)) {
            if (pattern.includes("OperatingIncome") && key.includes("NonOperating")) continue;
            if (key.includes("DecreaseIncreaseIn") || key.includes("AllowanceFor")) continue;
            if (key.includes("Unearned") || key.includes("Deferred")) continue;
            const list = fallbackAll[key];
            if (list && list.length > 0) {
              if (isPriorFallback) {
                return list.length >= 2 ? list[list.length - 2] : undefined;
              }
              return list[list.length - 1];
            }
          }
        }
      }
    }

    return undefined;
  };

  // 合算または合計タグ取得ヘルパー（内訳合算ルール対応）
  const findCompositeValue = (
    def: { totalTags: string[]; componentTags?: string[] },
    contextList: RawTagEntry[],
    fallbackAll: Record<string, number[]>,
    isPriorFallback = false
  ): number | undefined => {
    // まず合計タグを探索（完全一致限定）
    const total = findValue(def.totalTags, contextList, fallbackAll, isPriorFallback, true);
    if (total !== undefined) return total;

    // 内訳合算（完全一致限定）
    if (def.componentTags && def.componentTags.length > 0) {
      let sum = 0;
      let foundAny = false;
      for (const compTag of def.componentTags) {
        const val = findValue([compTag], contextList, fallbackAll, isPriorFallback, true);
        if (val !== undefined) {
          sum += val;
          foundAny = true;
        }
      }
      if (foundAny) return sum;
    }

    return undefined;
  };

  const buildSnapshot = (
    targetEntries: RawTagEntry[],
    isPrior: boolean
  ): FinancialSnapshot => {
    // 四半期・中間決算において、前期PL項目は前年同四半期・前中間期のコンテキストを最優先
    const interimKeyword =
      isPrior && detectedPeriod !== "FY"
        ? detectedPeriod === "Q2"
          ? "Interim"
          : detectedPeriod === "Q1"
          ? "Quarter1"
          : "Quarter3"
        : undefined;

    const revenue = findValue(XBRL_TAG_DICTIONARY.revenue, targetEntries, allEntriesByTag, isPrior, false, interimKeyword);
    const operatingIncome = findValue(XBRL_TAG_DICTIONARY.operatingIncome, targetEntries, allEntriesByTag, isPrior, false, interimKeyword);
    const netIncome = findValue(XBRL_TAG_DICTIONARY.netIncome, targetEntries, allEntriesByTag, isPrior, false, interimKeyword);
    const operatingCashFlow = findValue(XBRL_TAG_DICTIONARY.operatingCashFlow, targetEntries, allEntriesByTag, isPrior, false, interimKeyword);
    let payoutRatio = findValue(XBRL_TAG_DICTIONARY.payoutRatio, targetEntries, allEntriesByTag, isPrior);
    const totalAssets = findValue(XBRL_TAG_DICTIONARY.totalAssets, targetEntries, allEntriesByTag, isPrior);

    // 連結配当性向の補正（有報サマリーで単体配当性向のみ開示されている場合、1株配当金と連結EPSから算出）
    const dividendPerShare = findValue(
      ["DividendPaidPerShareSummaryOfBusinessResults", "DividendPaidPerShare", "AnnualDividendPerShare"],
      targetEntries,
      allEntriesByTag,
      isPrior
    );
    const consolidatedEps = findValue(
      ["BasicEarningsLossPerShareSummaryOfBusinessResults", "BasicEarningsLossPerShare", "BasicEarningsPerShare"],
      targetEntries,
      allEntriesByTag,
      isPrior
    );
    if (dividendPerShare && consolidatedEps && consolidatedEps > 0) {
      payoutRatio = Number(((dividendPerShare / consolidatedEps) * 100).toFixed(1));
    }

    const tradeReceivables = findCompositeValue(XBRL_TAG_DICTIONARY.tradeReceivables, targetEntries, allEntriesByTag, isPrior);
    const inventories = findCompositeValue(XBRL_TAG_DICTIONARY.inventories, targetEntries, allEntriesByTag, isPrior);
    const cashAndDeposits = findValue(XBRL_TAG_DICTIONARY.cashAndDeposits, targetEntries, allEntriesByTag, isPrior);
    const currentAssets = findValue(XBRL_TAG_DICTIONARY.currentAssets, targetEntries, allEntriesByTag, isPrior);
    const propertyPlantAndEquipment = findValue(XBRL_TAG_DICTIONARY.propertyPlantAndEquipment, targetEntries, allEntriesByTag, isPrior);
    const currentLiabilities = findValue(XBRL_TAG_DICTIONARY.currentLiabilities, targetEntries, allEntriesByTag, isPrior);
    const netAssets = findValue(XBRL_TAG_DICTIONARY.netAssets, targetEntries, allEntriesByTag, isPrior);
    const retainedEarnings = findValue(XBRL_TAG_DICTIONARY.retainedEarnings, targetEntries, allEntriesByTag, isPrior);
    const investingCashFlow = findValue(XBRL_TAG_DICTIONARY.investingCashFlow, targetEntries, allEntriesByTag, isPrior, false, interimKeyword);
    const goodwill = findValue(XBRL_TAG_DICTIONARY.goodwill, targetEntries, allEntriesByTag, isPrior);

    const snapshot: FinancialSnapshot = {};
    if (revenue !== undefined) snapshot.revenue = revenue;
    if (operatingIncome !== undefined) snapshot.operatingIncome = operatingIncome;
    if (netIncome !== undefined) snapshot.netIncome = netIncome;
    if (operatingCashFlow !== undefined) snapshot.operatingCashFlow = operatingCashFlow;
    if (payoutRatio !== undefined) snapshot.payoutRatio = payoutRatio;
    if (totalAssets !== undefined) snapshot.totalAssets = totalAssets;

    if (tradeReceivables !== undefined) snapshot.tradeReceivables = tradeReceivables;
    if (inventories !== undefined) snapshot.inventories = inventories;
    if (cashAndDeposits !== undefined) snapshot.cashAndDeposits = cashAndDeposits;
    if (currentAssets !== undefined) snapshot.currentAssets = currentAssets;
    if (propertyPlantAndEquipment !== undefined) snapshot.propertyPlantAndEquipment = propertyPlantAndEquipment;
    if (currentLiabilities !== undefined) snapshot.currentLiabilities = currentLiabilities;
    if (netAssets !== undefined) snapshot.netAssets = netAssets;
    if (retainedEarnings !== undefined) snapshot.retainedEarnings = retainedEarnings;
    if (investingCashFlow !== undefined) snapshot.investingCashFlow = investingCashFlow;
    if (goodwill !== undefined) snapshot.goodwill = goodwill;

    return snapshot;
  };

  const currentSnapshot = buildSnapshot(currentEntries, false);
  const priorSnapshot = buildSnapshot(priorEntries, true);

  // 金融業フラグの補正（CurrentAssets が一切取れず、総資産と純資産はある場合も金融の可能性が高い）
  if (!isFinancial && !currentSnapshot.currentAssets && currentSnapshot.totalAssets) {
    for (const key of Object.keys(allEntriesByTag)) {
      if (key.includes("BNK") || key.includes("INS") || key.includes("SEC")) {
        isFinancial = true;
        break;
      }
    }
  }

  const result: KeyFinancialMetrics = {
    unit: "千円",
    standard: detectedStandard,
    periodType: detectedPeriod,
    isFinancialIndustry: isFinancial,
    current: currentSnapshot,
    prior: priorSnapshot,
  };

  // 下位互換用フラットプロパティ（Firestore crash 防止のため undefined なフィールドは set しない）
  if (currentSnapshot.revenue !== undefined) result.revenue = currentSnapshot.revenue;
  if (currentSnapshot.operatingIncome !== undefined) result.operatingIncome = currentSnapshot.operatingIncome;
  if (currentSnapshot.netIncome !== undefined) result.netIncome = currentSnapshot.netIncome;
  if (currentSnapshot.operatingCashFlow !== undefined) result.operatingCashFlow = currentSnapshot.operatingCashFlow;
  if (currentSnapshot.payoutRatio !== undefined) result.payoutRatio = currentSnapshot.payoutRatio;
  if (currentSnapshot.totalAssets !== undefined) result.totalAssets = currentSnapshot.totalAssets;

  return result;
}

const defaultEngine = new QuantitativeForensicEngine();

/**
 * 財務数値から定量的リスク（アクルーアル比率、DSRI、DSI、AQI、タコ足配当、流動性ショック、純資産毀損等）を判定
 * (Facade Pattern: QuantitativeForensicEngine に委譲)
 */
export function assessQuantitativeRisk(metrics: KeyFinancialMetrics): QuantitativeAssessment {
  return defaultEngine.assess(metrics);
}
