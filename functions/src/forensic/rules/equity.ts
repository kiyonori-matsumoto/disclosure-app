import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 7. 純資産・利益剰余金毀損率（債務超過・上場維持基準抵触リスク）
 * 継続赤字や減損による自己資本の急減、債務超過リスクを検知。
 */
export class EquityRule implements ForensicRule {
  readonly name = "EquityRule";

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
        detectedRedFlags.push("equity_erosion");
        warnings.push(
          cur.netAssets <= 0
            ? `[大幅乖離] 債務超過（純資産${cur.netAssets.toLocaleString()}千円）`
            : `[大幅乖離] 債務超過または累積赤字下での純資産${Math.abs(netAssetsDropRate * 100).toFixed(1)}%急減`
        );
        severity = "critical";
      } else if (!isFinancial && equityRatio < 0.1) {
        detectedRedFlags.push("equity_erosion");
        warnings.push(
          `[乖離あり] 自己資本比率が${(equityRatio * 100).toFixed(1)}%に低下（過大レバレッジ・財務脆弱性）`
        );
        severity = "warning";
      } else if (netAssetsDropRate <= -0.2) {
        detectedRedFlags.push("equity_erosion");
        warnings.push(
          `[乖離あり] 純資産が前期末比で${Math.abs(netAssetsDropRate * 100).toFixed(1)}%減少`
        );
        severity = "warning";
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
