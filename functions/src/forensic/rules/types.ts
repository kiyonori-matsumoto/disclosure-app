import {
  KeyFinancialMetrics,
  QuantitativeCalculations,
  RedFlagType,
  RiskLevel,
} from "../types";

export interface RuleEvaluationResult {
  detectedRedFlags: RedFlagType[];
  warnings: string[];
  severity: RiskLevel;
}

/**
 * フォレンジック判定ルールの共通インターフェース (Strategy Pattern)
 */
export interface ForensicRule {
  readonly name: string;
  evaluate(
    metrics: KeyFinancialMetrics,
    calculations: QuantitativeCalculations
  ): RuleEvaluationResult;
}
