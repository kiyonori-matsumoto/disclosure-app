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

      // 不動産開発業等（棚卸資産比率が総資産の35%以上）で自己資本が健全な場合、仕入れ先行による一時的CF乖離を考慮
      const isInventoryHeavy =
        cur.inventories !== undefined && cur.inventories / cur.totalAssets >= 0.35;
      const isEquityHealthy =
        cur.netAssets !== undefined && cur.netAssets / cur.totalAssets >= 0.25;

      if (accrualsRatio > 0.15) {
        detectedRedFlags.push("accruals_anomaly");
        if (isInventoryHeavy && isEquityHealthy) {
          warnings.push(
            `[WARNING] 総資産アクルーアル比率が高水準（${(accrualsRatio * 100).toFixed(1)}%：不動産・開発等の棚卸仕入れ先行型キャッシュ流出）`
          );
          severity = "warning";
        } else {
          warnings.push(
            `[CRITICAL] 総資産アクルーアル比率が${(accrualsRatio * 100).toFixed(1)}%（利益と営業CFが大幅乖離、架空利益・費用繰延の強い兆候）`
          );
          severity = "critical";
        }
      } else if (accrualsRatio > 0.08) {
        detectedRedFlags.push("accruals_anomaly");
        warnings.push(
          `[WARNING] 総資産アクルーアル比率が高水準（${(accrualsRatio * 100).toFixed(1)}%：利益に対してキャッシュ裏付けが不足）`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
