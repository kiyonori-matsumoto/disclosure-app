import {
  KeyFinancialMetrics,
  QuantitativeCalculations,
  RedFlagType,
  RiskLevel,
} from "../types";
import { AccrualsAnomalyRule } from "./accruals";
import { AqiRule } from "./aqi";
import { DsiRule } from "./dsi";
import { DsriRule } from "./dsri";
import { EquityRule } from "./equity";
import { LiquidityRule } from "./liquidity";
import { PayoutRule } from "./payout";
import { ForensicRule } from "./types";

export interface QuantitativeAssessment {
  metrics: KeyFinancialMetrics;
  detectedRedFlags: RedFlagType[];
  warnings: string[];
  severity: RiskLevel;
}

/**
 * 定量フォレンジック解析エンジン (Composite / Strategy Pattern)
 * 複数の独立したフォレンジック検証ルールを束ねて実行し、結果を集約する。
 */
export class QuantitativeForensicEngine {
  private rules: ForensicRule[];

  constructor(rules?: ForensicRule[]) {
    // デフォルトで7つの主要フォレンジックルールを登録
    this.rules = rules || [
      new AccrualsAnomalyRule(),
      new DsriRule(),
      new DsiRule(),
      new AqiRule(),
      new PayoutRule(),
      new LiquidityRule(),
      new EquityRule(),
    ];
  }

  /**
   * ルールの追加 (動的拡張用)
   */
  addRule(rule: ForensicRule): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * 財務数値セットを全ルールで評価し、総合深刻度とレッドフラグを集約する
   */
  assess(metrics: KeyFinancialMetrics): QuantitativeAssessment {
    const detectedRedFlags: RedFlagType[] = [];
    const warnings: string[] = [];
    const calculations: QuantitativeCalculations = {};
    let overallSeverity: RiskLevel = "normal";

    for (const rule of this.rules) {
      const result = rule.evaluate(metrics, calculations);

      for (const flag of result.detectedRedFlags) {
        if (!detectedRedFlags.includes(flag)) {
          detectedRedFlags.push(flag);
        }
      }

      for (const w of result.warnings) {
        warnings.push(w);
      }

      if (result.severity === "critical") {
        overallSeverity = "critical";
      } else if (result.severity === "warning" && overallSeverity !== "critical") {
        overallSeverity = "warning";
      }
    }

    metrics.calculations = calculations;

    return {
      metrics,
      detectedRedFlags,
      warnings,
      severity: overallSeverity,
    };
  }
}
