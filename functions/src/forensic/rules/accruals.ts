import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 1. 総資産アクルーアル比率 (Sloan's Accruals)
 * 会計純利益と営業CFの乖離（キャッシュ裏付けのないペーパー利益・費用繰延）を検知。
 * 金融業は業種特性のため除外。
 */
export class AccrualsAnomalyRule implements ForensicRule {
  readonly name = "AccrualsAnomalyRule";

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
    const isFinancial = metrics.isFinancialIndustry || false;
    const periodType = metrics.periodType || "FY";

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

      // 四半期・中間期決算における季節調整マルチプライヤー (中間期の回収サイト偏重を平準化)
      const seasonalMultiplier = periodType === "FY" ? 1.0 : 1.5;
      const critThreshold = 0.15 * seasonalMultiplier;
      const warnThreshold = 0.08 * seasonalMultiplier;

      // 建設・不動産等の仕入れ・工事支出先行型（運転資本比率が高く、本業黒字・資本健全）の判定
      const isWorkingCapitalHeavy =
        (cur.inventories !== undefined && cur.inventories / cur.totalAssets >= 0.30) ||
        (cur.tradeReceivables !== undefined && cur.tradeReceivables / cur.totalAssets >= 0.30);
      const isEquityHealthy =
        cur.netAssets !== undefined && cur.netAssets / cur.totalAssets >= 0.15;
      const isOperatingProfitable =
        cur.operatingIncome !== undefined && cur.operatingIncome > 0;

      const isBusinessCycleOutflow =
        isWorkingCapitalHeavy && isEquityHealthy && isOperatingProfitable;

      if (accrualsRatio > critThreshold) {
        detectedRedFlags.push("accruals_anomaly");
        if (isBusinessCycleOutflow) {
          warnings.push(
            `[乖離あり] 総資産アクルーアル比率が高水準（${(accrualsRatio * 100).toFixed(1)}%：建設・開発等の仕入・工事代金回収サイクル先行型キャッシュ流出）`
          );
          severity = "warning";
        } else {
          warnings.push(
            `[大幅乖離] 総資産アクルーアル比率が${(accrualsRatio * 100).toFixed(1)}%（利益と営業CFが大幅乖離、架空利益・費用繰延の強い兆候）`
          );
          severity = "critical";
        }
      } else if (accrualsRatio > warnThreshold) {
        detectedRedFlags.push("accruals_anomaly");
        warnings.push(
          `[乖離あり] 総資産アクルーアル比率が高水準（${(accrualsRatio * 100).toFixed(1)}%：利益に対してキャッシュ裏付けが不足）`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
