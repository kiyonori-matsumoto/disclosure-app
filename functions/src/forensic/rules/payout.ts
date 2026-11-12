import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 5. 営業CF・FCF・配当ギャップ（タコ足配当・過剰還元）
 * 本業でのキャッシュ創出力を伴わない借入依存の無理な配当維持、および利益剰余金欠損配当を検知。
 */
export class PayoutRule implements ForensicRule {
  readonly name = "PayoutRule";

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

    if (cur.operatingCashFlow !== undefined) {
      if (!isFinancial && cur.operatingCashFlow < 0) {
        if (cur.payoutRatio !== undefined && cur.payoutRatio > 100) {
          detectedRedFlags.push("unsustainable_payout");
          warnings.push(
            `[大幅乖離] 営業CF赤字（${cur.operatingCashFlow.toLocaleString()}千円）下での配当性向${cur.payoutRatio.toFixed(1)}%（危険なタコ足配当）`
          );
          severity = "critical";
        } else {
          detectedRedFlags.push("negative_operating_cf");
          warnings.push(
            `[乖離あり] 営業活動によるキャッシュ・フローがマイナス（${cur.operatingCashFlow.toLocaleString()}千円）`
          );
          severity = "warning";
        }
      } else if (cur.payoutRatio !== undefined && cur.payoutRatio > 100.0) {
        detectedRedFlags.push("unsustainable_payout");
        warnings.push(
          `[大幅乖離] 配当性向が ${cur.payoutRatio.toFixed(1)}%（当期利益を超える過剰配当）`
        );
        severity = "critical";
      }

      if (cur.investingCashFlow !== undefined) {
        const fcf = cur.operatingCashFlow + cur.investingCashFlow;
        calculations.fcf = fcf;
        const isDividendPaying = cur.payoutRatio !== undefined && cur.payoutRatio > 0;

        if (cur.retainedEarnings !== undefined && cur.retainedEarnings < 0 && isDividendPaying) {
          if (!detectedRedFlags.includes("unsustainable_payout")) detectedRedFlags.push("unsustainable_payout");
          warnings.push(
            `[大幅乖離] 利益剰余金マイナス（欠損）状態での配当実施`
          );
          severity = "critical";
        } else if (!isFinancial && fcf < 0 && cur.payoutRatio !== undefined && cur.payoutRatio > 50) {
          if (!detectedRedFlags.includes("unsustainable_payout")) detectedRedFlags.push("unsustainable_payout");
          warnings.push(
            `[乖離あり] フリーキャッシュフロー赤字（${fcf.toLocaleString()}千円）下の高配当性向（${cur.payoutRatio.toFixed(1)}%）`
          );
          if (severity !== "critical") severity = "warning";
        }
      }
    } else if (cur.payoutRatio !== undefined && cur.payoutRatio > 100.0) {
      detectedRedFlags.push("unsustainable_payout");
      warnings.push(`[大幅乖離] 配当性向が ${cur.payoutRatio.toFixed(1)}%（当期利益を超える過剰配当）`);
      severity = "critical";
    }

    return { detectedRedFlags, warnings, severity };
  }
}
