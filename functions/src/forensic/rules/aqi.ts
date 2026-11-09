import { FinancialSnapshot, KeyFinancialMetrics, QuantitativeCalculations, RedFlagType, RiskLevel } from "../types";
import { ForensicRule, RuleEvaluationResult } from "./types";

/**
 * 4. 資産の質指数 (Beneish AQI)
 * 非流動・非有形資産の割合の急増（開発費・販管費などの費用の資産化・繰延）を検知。
 * M&Aによるのれん（Goodwill）の急増（寄与率50%以上かつ投資CFマイナス）は正常な企業買収としてWarningに緩和。
 */
export class AqiRule implements ForensicRule {
  readonly name = "AqiRule";

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

        // その他資産（非流動・非有形資産）の実額増減とのれん増加額を算出
        const curOtherAssets = cur.totalAssets - (cur.currentAssets + cur.propertyPlantAndEquipment);
        const priOtherAssets = pri.totalAssets - (pri.currentAssets + pri.propertyPlantAndEquipment);
        const otherAssetsDelta = curOtherAssets - priOtherAssets;

        const goodwillDelta =
          cur.goodwill !== undefined && pri.goodwill !== undefined
            ? cur.goodwill - pri.goodwill
            : 0;

        // その他資産の純増額のうち、のれん（Goodwill）の増加が過半（50%以上）を占め、
        // かつ投資CFがマイナス（買収資金の流出）の場合、正規のM&Aによる資産計上と判定してWarningに留める
        const isGoodwillMnaDriven =
          goodwillDelta > 0 &&
          otherAssetsDelta > 0 &&
          goodwillDelta / otherAssetsDelta >= 0.5 &&
          cur.investingCashFlow !== undefined &&
          cur.investingCashFlow < 0;

        if (aqi > 1.254) {
          detectedRedFlags.push("asset_quality_deterioration");
          if (isGoodwillMnaDriven) {
            const gwPct = ((goodwillDelta / otherAssetsDelta) * 100).toFixed(0);
            warnings.push(
              `[WARNING] 資産の質指数(AQI)が前期比${aqi.toFixed(2)}倍に増加（M&A買収に伴うのれん計上要因：寄与率${gwPct}%）`
            );
            severity = "warning";
          } else {
            warnings.push(
              `[CRITICAL] 資産の質指数(AQI)が前期比${aqi.toFixed(2)}倍に急増（無形資産・その他資産への費用繰延の疑い）`
            );
            severity = "critical";
          }
        } else if (aqi > 1.15) {
          detectedRedFlags.push("asset_quality_deterioration");
          warnings.push(
            `[WARNING] 資産の質指数(AQI)が前期比${aqi.toFixed(2)}倍に増加（非流動・非有形資産の比率上昇）`
          );
          severity = "warning";
        }
      }
    }

    return { detectedRedFlags, warnings, severity };
  }
}
