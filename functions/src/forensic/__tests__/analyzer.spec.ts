import "jest";
import AdmZip from "adm-zip";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { ForensicAnalyzer } from "../analyzer";

describe("ForensicAnalyzer", () => {
  it("should analyze a healthy company disclosure zip and return normal risk level", async () => {
    const zip = new AdmZip();
    const mockHtm = `
      <html>
        <body>
          <ix:nonFraction name="jppfs_cor:NetSalesSummaryOfBusinessResults" scale="6">45000000</ix:nonFraction>
          <ix:nonFraction name="jppfs_cor:OperatingIncome" scale="6">5000000</ix:nonFraction>
          <ix:nonFraction name="jppfs_cor:NetCashProvidedByUsedInOperatingActivities" scale="6">4000000</ix:nonFraction>
          <ix:nonNumeric name="jppfs_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock">
            当社グループは強固な収益基盤に基づき、順調に事業を拡大いたしました。
          </ix:nonNumeric>
        </body>
      </html>
    `;
    zip.addFile("XBRL/PublicDoc/honbun.htm", Buffer.from(mockHtm, "utf-8"));

    const mockClient = {
      systemOne: jest.fn().mockImplementation(({ state }) => {
        if (state.role.includes("Financial")) {
          return Promise.resolve({
            answers: {
              risk_level: { choice: "normal" },
              flag_going_concern: { noul: 0.0 },
              flag_covenant: { noul: 0.0 },
              flag_negative_cf: { noul: 0.0 },
              flag_inventory_receivable: { noul: 0.0 },
              flag_impairment: { noul: 0.0 },
              flag_debt_pressure: { noul: 0.0 },
              flag_payout: { noul: 0.0 },
              flag_subsequent: { noul: 0.0 },
            },
          });
        }
        return Promise.resolve({
          answers: {
            has_negative_factors: { noul: 0.1 },
            blame_attribution: { choice: "none" },
            unfounded_optimism: { noul: 0.0 },
            is_risk_materialized: { noul: 0.0 },
            cause_fx: { noul: 0.0 },
            cause_raw_material: { noul: 0.0 },
            cause_weather: { noul: 0.0 },
            cause_geopolitics: { noul: 0.0 },
            cause_upfront: { noul: 0.0 },
            cause_weak_sales: { noul: 0.0 },
            cause_price_pass: { noul: 0.0 },
          },
        });
      }),
    } as unknown as TypeSafeClient;

    const analyzer = new ForensicAnalyzer({ client: mockClient });
    const result = await analyzer.analyzeZip(zip.toBuffer());

    expect(result.version).toBe(1);
    expect(result.riskLevel).toBe("normal");
    expect(result.tags).toEqual([]);
    expect(result.causes).toEqual([]);
    expect(result.metrics?.revenue).toBe(45000000000);
    expect(result.metrics?.operatingCashFlow).toBe(4000000000);
    expect(result.details.blameAttribution).toBe("none");
  });

  it("should analyze a distressed company disclosure zip (with negative operating CF & GC note) and return critical", async () => {
    const zip = new AdmZip();
    const mockHtm = `
      <html>
        <body>
          <ix:nonFraction name="jppfs_cor:NetSalesSummaryOfBusinessResults" scale="3">1580000</ix:nonFraction>
          <!-- 営業CFマイナス 280,000千円 -->
          <ix:nonFraction name="jppfs_cor:NetCashProvidedByUsedInOperatingActivities" sign="-" scale="3">280000</ix:nonFraction>
          <ix:nonNumeric name="jppfs_cor:EventsOrConditionsThatCastSignificantDoubtOnGoingConcernAssumptionTextBlock">
            当社は2期連続で営業キャッシュ・フローがマイナスとなっており、継続企業の前提に関する重要な疑義が存在しております。
          </ix:nonNumeric>
          <ix:nonNumeric name="jppfs_cor:ManagementAnalysisOfFinancialPositionOperatingResultsAndCashFlowsTextBlock">
            原材料高騰と市況悪化の影響により苦戦いたしましたが、下期には底打ち回復を見込んでおります。
          </ix:nonNumeric>
        </body>
      </html>
    `;
    zip.addFile("XBRL/PublicDoc/honbun.htm", Buffer.from(mockHtm, "utf-8"));

    const mockClient = {
      systemOne: jest.fn().mockImplementation(({ state }) => {
        if (state.role.includes("Financial")) {
          return Promise.resolve({
            answers: {
              risk_level: { choice: "critical" },
              flag_going_concern: { noul: 0.98 },
              flag_covenant: { noul: 0.1 },
              flag_negative_cf: { noul: 0.95 },
              flag_inventory_receivable: { noul: 0.2 },
              flag_impairment: { noul: 0.1 },
              flag_debt_pressure: { noul: 0.4 },
              flag_payout: { noul: 0.0 },
              flag_subsequent: { noul: 0.0 },
            },
          });
        }
        return Promise.resolve({
          answers: {
            has_negative_factors: { noul: 0.9 },
            blame_attribution: { choice: "external_macro_dominant" },
            unfounded_optimism: { noul: 0.8 },
            is_risk_materialized: { noul: 0.1 },
            cause_fx: { noul: 0.2 },
            cause_raw_material: { noul: 0.9 },
            cause_weather: { noul: 0.0 },
            cause_geopolitics: { noul: 0.8 },
            cause_upfront: { noul: 0.0 },
            cause_weak_sales: { noul: 0.2 },
            cause_price_pass: { noul: 0.1 },
          },
        });
      }),
    } as unknown as TypeSafeClient;

    const analyzer = new ForensicAnalyzer({ client: mockClient });
    const result = await analyzer.analyzeZip(zip.toBuffer());

    expect(result.riskLevel).toBe("critical");
    expect(result.tags).toContain("going_concern");
    expect(result.tags).toContain("negative_operating_cf");
    expect(result.tags).toContain("blame_external_macro");
    expect(result.tags).toContain("unfounded_optimism");
    expect(result.causes).toContain("raw_material_energy");
    expect(result.causes).toContain("market_or_geopolitics");
    expect(result.metrics?.operatingCashFlow).toBe(-280000);
    expect(result.details.unfoundedOptimism).toBe(true);
  });
});
