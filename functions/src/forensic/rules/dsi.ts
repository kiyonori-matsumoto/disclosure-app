import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 3. 棚卸資産回転期間指数 (DSI Index)
 * 売上高に対する棚卸資産の異常膨張（架空在庫・原価付け替え・不良在庫滞留）を検知。
 */
export class DsiRule implements ForensicRule {
  readonly name = "DsiRule";

  evaluate(metrics: KeyFinancialMetrics, calculations: QuantitativeCalculations): RuleEvaluationResult {
    const detectedRedFlags: RedFlagType[] = [];
    const warnings: string[] = [];
    let severity: RiskLevel = "normal";

    const cur: FinancialSnapshot = metrics.current || {
      revenue: metrics.revenue,
      operatingIncome: metrics.operatingIncome,
      netIncome: metrics.netIncome,
      operatingCashFlow: metrics.operatingCashFlow,
      payoutRatio: metrics.payoutRatio,
      totalAssets: metrics.totalAssets,
    };
    const pri: FinancialSnapshot = metrics.prior || {};
    const isFinancial = metrics.isFinancialIndustry || false;
    const periodType = metrics.periodType || "FY";

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
      const annualizeFactor =
        periodType === "Q1" ? 4 : periodType === "Q2" ? 2 : periodType === "Q3" ? 4 / 3 : 1;
      const seasonalMultiplier = periodType === "FY" ? 1.0 : 1.2;

      const curAnnualRevenue = cur.revenue * annualizeFactor;
      const isPriorAccumulatedQuarter =
        periodType !== "FY" && pri.revenue < cur.revenue * 1.35;
      const priAnnualRevenue = isPriorAccumulatedQuarter
        ? pri.revenue * annualizeFactor
        : pri.revenue;

      const curInvRatio = cur.inventories / curAnnualRevenue;
      const priInvRatio = pri.inventories / priAnnualRevenue;
      const dsiIndex = curInvRatio / priInvRatio;
      calculations.dsiIndex = Number(dsiIndex.toFixed(3));

      const critThreshold = Number((1.50 * seasonalMultiplier).toFixed(3));
      const warnThreshold = Number((1.25 * seasonalMultiplier).toFixed(3));

      if (dsiIndex > critThreshold) {
        detectedRedFlags.push("inventory_receivable_surge");
        warnings.push(
          `[CRITICAL] 棚卸資産回転期間指数(DSI)が前期比${dsiIndex.toFixed(2)}倍に異常膨張（架空在庫・原価付け替え・不良在庫滞留リスク）`
        );
        severity = "critical";
      } else if (dsiIndex > warnThreshold) {
        detectedRedFlags.push("inventory_receivable_surge");
        warnings.push(
          `[WARNING] 棚卸資産回転期間指数(DSI)が前期比${dsiIndex.toFixed(2)}倍に長期化`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
