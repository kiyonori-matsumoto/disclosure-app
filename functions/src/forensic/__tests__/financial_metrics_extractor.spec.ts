import "jest";
import AdmZip from "adm-zip";
import {
  assessQuantitativeRisk,
  extractFinancialMetricsFromZip,
} from "../financial_metrics_extractor";
import { KeyFinancialMetrics } from "../types";

describe("financial_metrics_extractor", () => {
  it("should extract financial metrics from EDINET iXBRL zip buffer", () => {
    const zip = new AdmZip();
    const mockHtm = `
      <html>
        <body>
          <!-- 売上高: 百万円単位 (scale="6") 45,100,000 -> 45,100,000,000 千円 -->
          <ix:nonFraction name="jppfs_cor:NetSalesSummaryOfBusinessResults" scale="6">45100000</ix:nonFraction>
          <!-- 営業利益: 百万円単位 (scale="6") 5,350,000 -> 5,350,000,000 千円 -->
          <ix:nonFraction name="jppfs_cor:OperatingIncome" scale="6">5350000</ix:nonFraction>
          <!-- 純利益: 百万円単位 (scale="6") 4,940,000 -> 4,940,000,000 千円 -->
          <ix:nonFraction name="jppfs_cor:ProfitLossAttributableToOwnersOfParent" scale="6">4940000</ix:nonFraction>
          <!-- 営業CF: 百万円単位 (scale="6") 4,200,000 -> 4,200,000,000 千円 -->
          <ix:nonFraction name="jppfs_cor:NetCashProvidedByUsedInOperatingActivities" scale="6">4200000</ix:nonFraction>
          <!-- 配当性向: scaleなし (%) -->
          <ix:nonFraction name="jpcrp_cor:PayoutRatio">28.5</ix:nonFraction>
        </body>
      </html>
    `;
    zip.addFile("XBRL/PublicDoc/0101010_honbun.htm", Buffer.from(mockHtm, "utf-8"));
    const zipBuffer = zip.toBuffer();

    const metrics = extractFinancialMetricsFromZip(zipBuffer);

    expect(metrics.revenue).toBe(45100000000);
    expect(metrics.operatingIncome).toBe(5350000000);
    expect(metrics.netIncome).toBe(4940000000);
    expect(metrics.operatingCashFlow).toBe(4200000000);
    expect(metrics.payoutRatio).toBe(28.5);
    expect(metrics.unit).toBe("千円");

    const assessment = assessQuantitativeRisk(metrics);
    expect(assessment.detectedRedFlags).toEqual([]);
    expect(assessment.warnings).toEqual([]);
  });

  it("should extract financial metrics from TDnet iXBRL zip buffer (tse-ed-t tags)", () => {
    const zip = new AdmZip();
    const mockHtm = `
      <html>
        <body>
          <!-- TDnet サマリー: 百万円単位 (scale="6") -->
          <ix:nonFraction name="tse-ed-t:NetSales" scale="6">15556</ix:nonFraction>
          <ix:nonFraction name="tse-ed-t:OperatingIncome" scale="6">6161</ix:nonFraction>
          <ix:nonFraction name="tse-ed-t:ProfitLossAttributableToOwnersOfParent" scale="6">4200</ix:nonFraction>
          <!-- 営業CF: マイナス値 (sign="-", scale="6") 280百万円流出 -->
          <ix:nonFraction name="tse-ed-t:NetCashProvidedByUsedInOperatingActivities" sign="-" scale="6">280</ix:nonFraction>
        </body>
      </html>
    `;
    zip.addFile("XBRLData/Summary/tse-acedjpsm-ixbrl.htm", Buffer.from(mockHtm, "utf-8"));
    const zipBuffer = zip.toBuffer();

    const metrics = extractFinancialMetricsFromZip(zipBuffer);

    expect(metrics.revenue).toBe(15556000);
    expect(metrics.operatingIncome).toBe(6161000);
    expect(metrics.netIncome).toBe(4200000);
    expect(metrics.operatingCashFlow).toBe(-280000);

    const assessment = assessQuantitativeRisk(metrics);
    expect(assessment.detectedRedFlags).toContain("negative_operating_cf");
    expect(assessment.warnings.length).toBeGreaterThan(0);
    expect(assessment.warnings[0]).toContain("マイナス");
  });

  it("should detect unsustainable payout when payout ratio exceeds 100%", () => {
    const metrics: KeyFinancialMetrics = {
      revenue: 1000000,
      operatingCashFlow: 50000,
      payoutRatio: 125.4,
      unit: "千円",
    };

    const assessment = assessQuantitativeRisk(metrics);
    expect(assessment.detectedRedFlags).toContain("unsustainable_payout");
    expect(assessment.warnings.some((w) => w.includes("配当性向が 125.4%"))).toBe(true);
  });
});
