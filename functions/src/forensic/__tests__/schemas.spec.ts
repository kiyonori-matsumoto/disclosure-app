import "jest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { detectFinancialAnomaly } from "../schemas/financial_anomaly";
import { detectQualitativeExcuses } from "../schemas/qualitative_excuses";

describe("forensic schemas", () => {
  it("should detect going concern red flag and promote risk level to critical", async () => {
    const mockClient = {
      systemOne: jest.fn().mockResolvedValue({
        answers: {
          risk_level: { choice: "critical" },
          flag_going_concern: { noul: 0.95 },
          flag_covenant: { noul: 0.1 },
          flag_negative_cf: { noul: 0.8 },
          flag_inventory_receivable: { noul: 0.2 },
          flag_impairment: { noul: 0.1 },
          flag_debt_pressure: { noul: 0.3 },
          flag_payout: { noul: 0.0 },
          flag_subsequent: { noul: 0.0 },
        },
      }),
    } as unknown as TypeSafeClient;

    const result = await detectFinancialAnomaly(
      mockClient,
      "継続企業の前提に関する重要な不確実性が認められます。営業活動によるキャッシュフローはマイナスであります。",
      { revenue: 1580000, operatingCashFlow: -280000, unit: "千円" }
    );

    expect(result.riskLevel).toBe("critical");
    expect(result.detectedRedFlags).toContain("going_concern");
    expect(result.detectedRedFlags).toContain("negative_operating_cf");
  });

  it("should detect external blame and unfounded optimism in qualitative excuses", async () => {
    const mockClient = {
      systemOne: jest.fn().mockResolvedValue({
        answers: {
          has_negative_factors: { noul: 0.9 },
          blame_attribution: { choice: "external_macro_dominant" },
          unfounded_optimism: { noul: 0.85 },
          is_risk_materialized: { noul: 0.2 },
          cause_fx: { noul: 0.8 },
          cause_raw_material: { noul: 0.9 },
          cause_weather: { noul: 0.1 },
          cause_geopolitics: { noul: 0.2 },
          cause_upfront: { noul: 0.1 },
          cause_weak_sales: { noul: 0.3 },
          cause_price_pass: { noul: 0.75 },
        },
      }),
    } as unknown as TypeSafeClient;

    const result = await detectQualitativeExcuses(
      mockClient,
      "急激な円安と原材料・原油価格の高騰により大幅な減益となりましたが、足元では底打ちしており下期回復を見込みます。"
    );

    expect(result.hasNegativeFactors).toBe(true);
    expect(result.blameAttribution).toBe("external_macro_dominant");
    expect(result.unfoundedOptimism).toBe(true);
    expect(result.toneTags).toContain("blame_external_macro");
    expect(result.toneTags).toContain("unfounded_optimism");
    expect(result.causeTags).toContain("fx_fluctuation");
    expect(result.causeTags).toContain("raw_material_energy");
    expect(result.causeTags).toContain("delayed_price_pass");
  });
});
