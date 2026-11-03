import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { BlameAttribution, CauseTag, KeyFinancialMetrics, ToneTag } from "../types";

export interface QualitativeExcusesResult {
  hasNegativeFactors: boolean;
  blameAttribution: BlameAttribution;
  unfoundedOptimism: boolean;
  causeTags: CauseTag[];
  toneTags: ToneTag[];
}

/**
 * Jev (System One) による「定性言い訳・責任転嫁・楽観姿勢」判定
 */
export async function detectQualitativeExcuses(
  client: TypeSafeClient,
  mdaText: string,
  riskText?: string,
  metrics?: KeyFinancialMetrics
): Promise<QualitativeExcusesResult> {
  const combinedText = `${mdaText}\n${riskText || ""}`.trim().slice(0, 3500);

  const statePayload: Record<string, any> = {
    role: "Management Tone Auditor",
    task: "Analyze management discussion and detect attribution patterns and excuses.",
    extracted_text: combinedText,
  };

  if (metrics) {
    statePayload.financial_data = {
      revenue: metrics.revenue !== undefined ? `${metrics.revenue} 千円` : undefined,
      operating_income: metrics.operatingIncome !== undefined ? `${metrics.operatingIncome} 千円` : undefined,
      net_income: metrics.netIncome !== undefined ? `${metrics.netIncome} 千円` : undefined,
      operating_cash_flow: metrics.operatingCashFlow !== undefined ? `${metrics.operatingCashFlow} 千円` : undefined,
    };
  }

  const response = await client.systemOne({
    state: statePayload,
    questions: {
      has_negative_factors: noul("減収減益や利益圧迫要因についての言及が存在しますか？"),
      blame_attribution: choice("経営陣が説明する業績不振・減益の主因を分類してください。", {
        external_macro_dominant: "為替、原材料高、資源高、天候、地政学等に全責任転嫁している",
        temporary_one_off: "「一過性の先行投資・システム切替」等の一時的要因と強弁している",
        internal_acknowledged: "自社の価格競争力低下、需要減退、解約増など自社課題を認めている",
        none: "そもそも減益要因の言及なし、または業績好調",
      }),
      unfounded_optimism: noul(
        "「足元底打ち」「中長期的には堅調」「下期回復を見込む」等の具体的数値根拠を欠く楽観形容詞が含まれますか？"
      ),
      is_risk_materialized: noul(
        "「損害賠償」「訴訟」「不正」「取引停止」「損失計上」などリスクが実際に顕在化した記述がありますか？"
      ),
      // 原因タグ (Noul)
      cause_fx: noul("為替変動（円安・円高の影響）に関する言及がありますか？"),
      cause_raw_material: noul("原材料・エネルギー・資材価格の高騰に関する言及がありますか？"),
      cause_weather: noul("天候不順、台風、豪雪、猛暑、自然災害に関する言及がありますか？"),
      cause_geopolitics: noul("市況悪化、海外景気減速、地政学リスク、紛争に関する言及がありますか？"),
      cause_upfront: noul("先行投資、システム切替、拠点新設、研究開発費など一時的費用に関する言及がありますか？"),
      cause_weak_sales: noul("販売数量の減少、来店客数の減少、顧客離れ、解約増に関する言及がありますか？"),
      cause_price_pass: noul("価格転嫁（値上げ）の遅れや浸透不足に関する言及がありますか？"),
    },
  });

  const answers = response.answers;
  const hasNegativeFactors = answers.has_negative_factors.noul >= 0.55;
  const blameAttribution = answers.blame_attribution.choice as BlameAttribution;
  const unfoundedOptimism = answers.unfounded_optimism.noul >= 0.65;

  const causeTags: CauseTag[] = [];
  if (answers.cause_fx.noul >= 0.65) causeTags.push("fx_fluctuation");
  if (answers.cause_raw_material.noul >= 0.65) causeTags.push("raw_material_energy");
  if (answers.cause_weather.noul >= 0.65) causeTags.push("weather_or_disaster");
  if (answers.cause_geopolitics.noul >= 0.65) causeTags.push("market_or_geopolitics");
  if (answers.cause_upfront.noul >= 0.65) causeTags.push("upfront_investment");
  if (answers.cause_weak_sales.noul >= 0.65) causeTags.push("weak_sales_or_churn");
  if (answers.cause_price_pass.noul >= 0.65) causeTags.push("delayed_price_pass");

  const toneTags: ToneTag[] = [];
  if (blameAttribution === "external_macro_dominant") {
    toneTags.push("blame_external_macro");
  } else if (blameAttribution === "temporary_one_off") {
    toneTags.push("blame_temporary_one_off");
  }

  if (unfoundedOptimism) {
    toneTags.push("unfounded_optimism");
  }

  if (answers.is_risk_materialized.noul >= 0.7) {
    toneTags.push("risk_materialized");
  }

  return {
    hasNegativeFactors,
    blameAttribution,
    unfoundedOptimism,
    causeTags,
    toneTags,
  };
}
