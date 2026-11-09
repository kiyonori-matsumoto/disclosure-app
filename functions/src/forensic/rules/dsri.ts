import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 2. 売上債権回転期間指数 (Beneish DSRI)
 * 売上高に対する売上債権の急増（期末の押し込み販売・架空売上・回収滞留リスク）を検知。
 */
export class DsriRule implements ForensicRule {
  readonly name = "DsriRule";

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
      cur.tradeReceivables !== undefined &&
      cur.revenue !== undefined &&
      cur.revenue > 0 &&
      pri.tradeReceivables !== undefined &&
      pri.revenue !== undefined &&
      pri.revenue > 0 &&
      pri.tradeReceivables > 0
    ) {
      const annualizeFactor =
        periodType === "Q1" ? 4 : periodType === "Q2" ? 2 : periodType === "Q3" ? 4 / 3 : 1;
      const seasonalMultiplier = periodType === "FY" ? 1.0 : 1.2;

      // 四半期・半期の累計売上高を通期年換算して回転期間の期間単位を平準化
      const curAnnualRevenue = cur.revenue * annualizeFactor;
      // 前期売上高が同四半期累計（当期累計売上と同規模）の場合は年換算し、通期売上の場合はそのまま使用
      const isPriorAccumulatedQuarter =
        periodType !== "FY" && pri.revenue < cur.revenue * 1.35;
      const priAnnualRevenue = isPriorAccumulatedQuarter
        ? pri.revenue * annualizeFactor
        : pri.revenue;

      const curTurnover = cur.tradeReceivables / curAnnualRevenue;
      const priTurnover = pri.tradeReceivables / priAnnualRevenue;
      const dsri = curTurnover / priTurnover;
      calculations.dsri = Number(dsri.toFixed(3));

      const critThreshold = Number((1.465 * seasonalMultiplier).toFixed(3));
      const warnThreshold = Number((1.20 * seasonalMultiplier).toFixed(3));

      if (dsri > critThreshold) {
        detectedRedFlags.push("inventory_receivable_surge");
        warnings.push(
          `[CRITICAL] 売上債権回転期間指数(DSRI)が前期比${dsri.toFixed(2)}倍に急増（押し込み販売・架空売上・回収滞留リスク）`
        );
        severity = "critical";
      } else if (dsri > warnThreshold) {
        detectedRedFlags.push("inventory_receivable_surge");
        warnings.push(
          `[WARNING] 売上債権回転期間指数(DSRI)が前期比${dsri.toFixed(2)}倍に悪化（回収サイト長期化）`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
