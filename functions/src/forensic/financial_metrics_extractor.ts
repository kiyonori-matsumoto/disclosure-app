import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import {
  AccountingStandard,
  FiscalPeriodType,
  FinancialSnapshot,
  KeyFinancialMetrics,
  QuantitativeCalculations,
  RedFlagType,
  RiskLevel,
} from "./types";

export interface QuantitativeAssessment {
  metrics: KeyFinancialMetrics;
  detectedRedFlags: RedFlagType[];
  warnings: string[];
  severity: RiskLevel;
}

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
    "NetSalesSummaryOfBusinessResults",
    "OrdinaryIncomeBNK",
    "OrdinaryIncomeSummaryOfBusinessResults",
    "OperatingRevenuesSEC",
    "OrdinaryIncomeINS",
    "OperatingRevenues",
    "NetSales",
    "OperatingRevenue",
    "Revenue",
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
export function extractFinancialMetricsFromZip(zipBufferOrPath: Buffer | string): KeyFinancialMetrics {
  const zip = typeof zipBufferOrPath === "string" ? new AdmZip(zipBufferOrPath) : new AdmZip(zipBufferOrPath);
  const entries = zip.getEntries();

  const currentEntries: RawTagEntry[] = [];
  const priorEntries: RawTagEntry[] = [];
  const allEntriesByTag: Record<string, number[]> = {};

  let detectedStandard: AccountingStandard = "J-GAAP";
  let detectedPeriod: FiscalPeriodType = "FY";
  let isFinancial = false;

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
      content.includes("UnderwritingIncomeINS")
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
    exactMatchOnly = false
  ): number | undefined => {
    // 連結決算企業では連結コンテキスト（!NonConsolidated）を最優先し、単体企業では全体から探索
    const consolidatedList = contextList.filter((item) => !item.contextRef.includes("NonConsolidated"));
    const listsToSearch = consolidatedList.length > 0 ? [consolidatedList, contextList] : [contextList];

    for (const targetList of listsToSearch) {
      // 1. 完全一致（ローカル名またはフル名）
      for (const pattern of patterns) {
        for (let i = targetList.length - 1; i >= 0; i--) {
          const item = targetList[i];
          if (item.name.endsWith(":" + pattern) || item.name === pattern) {
            return item.value;
          }
        }
      }

      if (!exactMatchOnly) {
        // 2. 部分一致（完全一致で見つからなかった場合のみ）
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
    const revenue = findValue(XBRL_TAG_DICTIONARY.revenue, targetEntries, allEntriesByTag, isPrior);
    const operatingIncome = findValue(XBRL_TAG_DICTIONARY.operatingIncome, targetEntries, allEntriesByTag, isPrior);
    const netIncome = findValue(XBRL_TAG_DICTIONARY.netIncome, targetEntries, allEntriesByTag, isPrior);
    const operatingCashFlow = findValue(XBRL_TAG_DICTIONARY.operatingCashFlow, targetEntries, allEntriesByTag, isPrior);
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
    const investingCashFlow = findValue(XBRL_TAG_DICTIONARY.investingCashFlow, targetEntries, allEntriesByTag, isPrior);

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

/**
 * 財務数値から定量的リスク（アクルーアル比率、DSRI、DSI、AQI、タコ足配当、流動性ショック、純資産毀損等）を判定
 */
export function assessQuantitativeRisk(metrics: KeyFinancialMetrics): QuantitativeAssessment {
  const detectedRedFlags: RedFlagType[] = [];
  const warnings: string[] = [];
  const calculations: QuantitativeCalculations = {};

  const cur = metrics.current || {
    revenue: metrics.revenue,
    operatingIncome: metrics.operatingIncome,
    netIncome: metrics.netIncome,
    operatingCashFlow: metrics.operatingCashFlow,
    payoutRatio: metrics.payoutRatio,
    totalAssets: metrics.totalAssets,
  };
  const pri = metrics.prior || {};
  const periodType = metrics.periodType || "FY";
  const isFinancial = metrics.isFinancialIndustry || false;

  const seasonalMultiplier = periodType === "FY" ? 1.0 : 1.2;
  let severity: RiskLevel = "normal";

  const markCritical = (flag: RedFlagType, msg: string) => {
    if (!detectedRedFlags.includes(flag)) detectedRedFlags.push(flag);
    warnings.push(`[CRITICAL] ${msg}`);
    severity = "critical";
  };

  const markWarning = (flag: RedFlagType, msg: string) => {
    if (!detectedRedFlags.includes(flag)) detectedRedFlags.push(flag);
    warnings.push(`[WARNING] ${msg}`);
    if (severity !== "critical") severity = "warning";
  };

  // ---------------------------------------------------------------------------
  // 1. 総資産アクルーアル比率 (Sloan's Accruals) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancial &&
    cur.netIncome !== undefined &&
    cur.operatingCashFlow !== undefined &&
    cur.totalAssets !== undefined &&
    cur.totalAssets > 0
  ) {
    const annualizeFactor =
      periodType === "Q1" ? 4 : periodType === "Q2" ? 2 : periodType === "Q3" ? 4 / 3 : 1;
    const accrualsRatio =
      ((cur.netIncome - cur.operatingCashFlow) * annualizeFactor) / cur.totalAssets;
    calculations.accrualsRatio = Number(accrualsRatio.toFixed(4));

    if (accrualsRatio > 0.15) {
      markCritical(
        "accruals_anomaly",
        `総資産アクルーアル比率が${(accrualsRatio * 100).toFixed(1)}%（利益と営業CFが大幅乖離、架空利益・費用繰延の強い兆候）`
      );
    } else if (accrualsRatio > 0.08) {
      markWarning(
        "accruals_anomaly",
        `総資産アクルーアル比率が高水準（${(accrualsRatio * 100).toFixed(1)}%：利益に対してキャッシュ裏付けが不足）`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 売上債権回転期間指数 (Beneish DSRI) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancial &&
    cur.tradeReceivables !== undefined &&
    cur.revenue !== undefined &&
    cur.revenue > 0 &&
    pri.tradeReceivables !== undefined &&
    pri.revenue !== undefined &&
    pri.revenue > 0 &&
    pri.tradeReceivables > 0
  ) {
    const curTurnover = cur.tradeReceivables / cur.revenue;
    const priTurnover = pri.tradeReceivables / pri.revenue;
    const dsri = curTurnover / priTurnover;
    calculations.dsri = Number(dsri.toFixed(3));

    const critThreshold = Number((1.465 * seasonalMultiplier).toFixed(3));
    const warnThreshold = Number((1.20 * seasonalMultiplier).toFixed(3));

    if (dsri > critThreshold) {
      markCritical(
        "inventory_receivable_surge",
        `売上債権回転期間指数(DSRI)が前期比${dsri.toFixed(2)}倍に急増（押し込み販売・架空売上・回収滞留リスク）`
      );
    } else if (dsri > warnThreshold) {
      markWarning(
        "inventory_receivable_surge",
        `売上債権回転期間指数(DSRI)が前期比${dsri.toFixed(2)}倍に悪化（回収サイト長期化）`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 3. 棚卸資産回転期間指数 (DSI Index) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancial &&
    cur.inventories !== undefined &&
    cur.revenue !== undefined &&
    cur.revenue > 0 &&
    pri.inventories !== undefined &&
    pri.revenue !== undefined &&
    pri.revenue > 0 &&
    pri.inventories > 0
  ) {
    const curInvRatio = cur.inventories / cur.revenue;
    const priInvRatio = pri.inventories / pri.revenue;
    const dsiIndex = curInvRatio / priInvRatio;
    calculations.dsiIndex = Number(dsiIndex.toFixed(3));

    const critThreshold = Number((1.50 * seasonalMultiplier).toFixed(3));
    const warnThreshold = Number((1.25 * seasonalMultiplier).toFixed(3));

    if (dsiIndex > critThreshold) {
      markCritical(
        "inventory_receivable_surge",
        `棚卸資産回転期間指数(DSI)が前期比${dsiIndex.toFixed(2)}倍に異常膨張（架空在庫・原価付け替え・不良在庫滞留リスク）`
      );
    } else if (dsiIndex > warnThreshold) {
      markWarning(
        "inventory_receivable_surge",
        `棚卸資産回転期間指数(DSI)が前期比${dsiIndex.toFixed(2)}倍に長期化`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 4. 資産の質指数 (Beneish AQI) ※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancial &&
    cur.currentAssets !== undefined &&
    cur.propertyPlantAndEquipment !== undefined &&
    cur.totalAssets !== undefined &&
    cur.totalAssets > 0 &&
    pri.currentAssets !== undefined &&
    pri.propertyPlantAndEquipment !== undefined &&
    pri.totalAssets !== undefined &&
    pri.totalAssets > 0
  ) {
    const curOtherAssetsRatio = 1 - (cur.currentAssets + cur.propertyPlantAndEquipment) / cur.totalAssets;
    const priOtherAssetsRatio = 1 - (pri.currentAssets + pri.propertyPlantAndEquipment) / pri.totalAssets;

    if (curOtherAssetsRatio >= 0.15 && priOtherAssetsRatio > 0.05) {
      const aqi = curOtherAssetsRatio / priOtherAssetsRatio;
      calculations.aqi = Number(aqi.toFixed(3));

      if (aqi > 1.254) {
        markCritical(
          "asset_quality_deterioration",
          `資産の質指数(AQI)が前期比${aqi.toFixed(2)}倍に急増（無形資産・その他資産への費用繰延の疑い）`
        );
      } else if (aqi > 1.15) {
        markWarning(
          "asset_quality_deterioration",
          `資産の質指数(AQI)が前期比${aqi.toFixed(2)}倍に増加（非有形固定資産の比率上昇）`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. 営業CF・FCF・配当ギャップ（タコ足配当）※金融業は営業CF/FCFの振れが業務特性のため除外
  // ---------------------------------------------------------------------------
  if (cur.operatingCashFlow !== undefined) {
    if (!isFinancial && cur.operatingCashFlow < 0) {
      if (cur.payoutRatio !== undefined && cur.payoutRatio > 100) {
        markCritical(
          "unsustainable_payout",
          `営業CF赤字（${cur.operatingCashFlow.toLocaleString()}千円）下での配当性向${cur.payoutRatio.toFixed(1)}%（危険なタコ足配当）`
        );
      } else {
        markWarning(
          "negative_operating_cf",
          `営業活動によるキャッシュ・フローがマイナス（${cur.operatingCashFlow.toLocaleString()}千円）`
        );
      }
    } else if (cur.payoutRatio !== undefined && cur.payoutRatio > 100.0) {
      markCritical(
        "unsustainable_payout",
        `配当性向が ${cur.payoutRatio.toFixed(1)}%（当期利益を超える過剰配当）`
      );
    }

    if (cur.investingCashFlow !== undefined) {
      const fcf = cur.operatingCashFlow + cur.investingCashFlow;
      calculations.fcf = fcf;
      const isDividendPaying = cur.payoutRatio !== undefined && cur.payoutRatio > 0;

      if (cur.retainedEarnings !== undefined && cur.retainedEarnings < 0 && isDividendPaying) {
        markCritical(
          "unsustainable_payout",
          `利益剰余金マイナス（欠損）状態での配当実施`
        );
      } else if (!isFinancial && fcf < 0 && cur.payoutRatio !== undefined && cur.payoutRatio > 50) {
        markWarning(
          "unsustainable_payout",
          `フリーキャッシュフロー赤字（${fcf.toLocaleString()}千円）下の高配当性向（${cur.payoutRatio.toFixed(1)}%）`
        );
      }
    }
  } else if (cur.payoutRatio !== undefined && cur.payoutRatio > 100.0) {
    markCritical(
      "unsustainable_payout",
      `配当性向が ${cur.payoutRatio.toFixed(1)}%`
    );
  }

  // ---------------------------------------------------------------------------
  // 6. 短期流動性ショック率（資金ショート予兆）※金融業は除外
  // ---------------------------------------------------------------------------
  if (
    !isFinancial &&
    cur.cashAndDeposits !== undefined &&
    cur.currentLiabilities !== undefined &&
    cur.currentLiabilities > 0
  ) {
    const cashCoverage = cur.cashAndDeposits / cur.currentLiabilities;
    calculations.cashCoverage = Number(cashCoverage.toFixed(4));

    const cashDropRate =
      pri.cashAndDeposits !== undefined && pri.cashAndDeposits > 0
        ? (cur.cashAndDeposits - pri.cashAndDeposits) / pri.cashAndDeposits
        : 0;
    calculations.cashDropRate = Number(cashDropRate.toFixed(4));

    if (cashCoverage < 0.08 && cur.operatingCashFlow !== undefined && cur.operatingCashFlow < 0) {
      markCritical(
        "liquidity_crunch",
        `流動負債に対する手元現預金比率が${(cashCoverage * 100).toFixed(1)}%かつ営業CF赤字（資金枯渇・黒字倒産危機）`
      );
    } else if (cashCoverage < 0.15 && cashDropRate <= -0.3) {
      markWarning(
        "liquidity_crunch",
        `手元現預金が前期末比${Math.abs(cashDropRate * 100).toFixed(1)}%急減（対流動負債比率${(cashCoverage * 100).toFixed(1)}%）`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 7. 純資産・利益剰余金毀損率（債務超過リスク）
  // ---------------------------------------------------------------------------
  if (cur.netAssets !== undefined && cur.totalAssets !== undefined && cur.totalAssets > 0) {
    const equityRatio = cur.netAssets / cur.totalAssets;
    calculations.equityRatio = Number(equityRatio.toFixed(4));

    const netAssetsDropRate =
      pri.netAssets !== undefined && pri.netAssets > 0
        ? (cur.netAssets - pri.netAssets) / pri.netAssets
        : 0;
    calculations.netAssetsDropRate = Number(netAssetsDropRate.toFixed(4));

    if (
      cur.netAssets <= 0 ||
      (cur.retainedEarnings !== undefined && cur.retainedEarnings < 0 && netAssetsDropRate <= -0.3)
    ) {
      markCritical(
        "equity_erosion",
        `債務超過または累積赤字下での純資産${Math.abs(netAssetsDropRate * 100).toFixed(1)}%急減`
      );
    } else if (!isFinancial && equityRatio < 0.1) {
      markWarning(
        "equity_erosion",
        `自己資本比率が${(equityRatio * 100).toFixed(1)}%（10%未満の過剰レバレッジ）`
      );
    }
  }

  metrics.calculations = calculations;

  return {
    metrics,
    detectedRedFlags,
    warnings,
    severity,
  };
}
