import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 6. 短期流動性ショック率（資金ショート予兆）
 * 手元流動性の急減および流動負債に対するカバー率低下（1年以内の黒字倒産・資金ショート危機）を検知。
 */
export class LiquidityRule implements ForensicRule {
  readonly name = "LiquidityRule";

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
        detectedRedFlags.push("liquidity_crunch");
        warnings.push(
          `[CRITICAL] 流動負債に対する手元現預金比率が${(cashCoverage * 100).toFixed(1)}%かつ営業CF赤字（資金枯渇・黒字倒産危機）`
        );
        severity = "critical";
      } else if (cashCoverage < 0.15 && cashDropRate <= -0.3) {
        detectedRedFlags.push("liquidity_crunch");
        warnings.push(
          `[WARNING] 手元現預金が前期末比${Math.abs(cashDropRate * 100).toFixed(1)}%急減（対流動負債比率${(cashCoverage * 100).toFixed(1)}%）`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
