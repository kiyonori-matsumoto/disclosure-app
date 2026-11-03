import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { KeyFinancialMetrics, RedFlagType, RiskLevel } from "../types";

export interface FinancialAnomalyResult {
  riskLevel: RiskLevel;
  detectedRedFlags: RedFlagType[];
}

/**
 * Jev (System One) による「財務・注記リスク」判定
 */
export async function detectFinancialAnomaly(
  client: TypeSafeClient,
  footnotesText: string,
  metrics?: KeyFinancialMetrics
): Promise<FinancialAnomalyResult> {
  const statePayload: Record<string, any> = {
    role: "Forensic Financial Screener",
    task: "Scan footnotes and financial excerpts for high-risk red flags.",
    extracted_notes: footnotesText.slice(0, 3500),
    rules: [
      "If text mentions going concern uncertainty (継続企業の前提に関する疑義・重要事象) or covenant breach, set risk_level = 'critical'.",
      "If financial data or text shows negative operating cash flow, flag negative_operating_cf.",
      "If debt pressure, impairment, or covenant breach is noted, flag respectively.",
    ].join("\n"),
  };

  if (metrics) {
    statePayload.financial_data = {
      revenue: metrics.revenue !== undefined ? `${metrics.revenue} 千円` : undefined,
      operating_income: metrics.operatingIncome !== undefined ? `${metrics.operatingIncome} 千円` : undefined,
      net_income: metrics.netIncome !== undefined ? `${metrics.netIncome} 千円` : undefined,
      operating_cash_flow: metrics.operatingCashFlow !== undefined ? `${metrics.operatingCashFlow} 千円` : undefined,
      payout_ratio: metrics.payoutRatio !== undefined ? `${metrics.payoutRatio} %` : undefined,
    };
  }

  const response = await client.systemOne({
    state: statePayload,
    questions: {
      risk_level: choice("財務・注記リスクの総合深刻度レベルを判定してください。", {
        critical: "GC注記、コベナンツ抵触など重大な存続・資金リスク",
        warning: "減損兆候、利払い負担増、営業CFマイナス、在庫急増などの懸念サイン",
        normal: "資金繰りや資産価値に特段の危険サインなし",
      }),
      flag_going_concern: noul("継続企業の前提に関する注記・疑義（GC注記）の記載がありますか？"),
      flag_covenant: noul("財務制限条項（コベナンツ）への抵触、または抵触懸念の記載がありますか？"),
      flag_negative_cf: noul("営業キャッシュ・フローのマイナスや本業での現金流出に関する言及がありますか？"),
      flag_inventory_receivable: noul(
        "棚卸資産（売れ残り在庫）や売上債権（未回収代金）の急増に関する記載がありますか？"
      ),
      flag_impairment: noul("固定資産やのれんの減損損失、または減損の兆候に関する記載がありますか？"),
      flag_debt_pressure: noul(
        "借入金の急増、利払い負担増、有利子負債の急増に関する記載がありますか？"
      ),
      flag_payout: noul(
        "当期純利益を超える配当・分配（利益超過分配）、または内部留保の大幅取崩しに関する記載がありますか？"
      ),
      flag_subsequent: noul(
        "重要な後発事象（重大訴訟、事故、大口取引終了、不正発覚等）に関する記載がありますか？"
      ),
    },
  });

  const answers = response.answers;
  const rawRiskLevel = answers.risk_level.choice as "critical" | "warning" | "normal";
  const detectedRedFlags: RedFlagType[] = [];

  if (answers.flag_going_concern.noul >= 0.65) detectedRedFlags.push("going_concern");
  if (answers.flag_covenant.noul >= 0.65) detectedRedFlags.push("covenant_breach");
  if (answers.flag_negative_cf.noul >= 0.65) detectedRedFlags.push("negative_operating_cf");
  if (answers.flag_inventory_receivable.noul >= 0.65) detectedRedFlags.push("inventory_receivable_surge");
  if (answers.flag_impairment.noul >= 0.65) detectedRedFlags.push("impairment_loss");
  if (answers.flag_debt_pressure.noul >= 0.65) detectedRedFlags.push("interest_debt_pressure");
  if (answers.flag_payout.noul >= 0.65) detectedRedFlags.push("unsustainable_payout");
  if (answers.flag_subsequent.noul >= 0.65) detectedRedFlags.push("subsequent_events");

  // GC注記やコベナンツ抵触が検知された場合は確実に critical に引き上げ
  let riskLevel: RiskLevel = rawRiskLevel;
  if (detectedRedFlags.includes("going_concern") || detectedRedFlags.includes("covenant_breach")) {
    riskLevel = "critical";
  } else if (detectedRedFlags.length > 0 && riskLevel === "normal") {
    riskLevel = "warning";
  }

  return {
    riskLevel,
    detectedRedFlags,
  };
}
