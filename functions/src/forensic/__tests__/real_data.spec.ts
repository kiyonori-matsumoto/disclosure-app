import "jest";
import * as fs from "fs";
import * as path from "path";
import { extractQualitativeSections, extractTdnetQualitativeHtml } from "../extractor";
import { extractFinancialMetricsFromZip } from "../financial_metrics_extractor";
import { ForensicAnalyzer } from "../analyzer";
import { TypeSafeClient } from "@typesafe-ai/sdk";

describe("Real Data Forensic Tests", () => {
  const fixturesDir = path.resolve(__dirname, "fixtures");

  describe("EDINET Real iXBRL (sample_current.htm from PR #71)", () => {
    it("should extract qualitative sections from real EDINET iXBRL file", () => {
      const htmlPath = path.join(fixturesDir, "edinet_sample_current.htm");
      const htmlContent = fs.readFileSync(htmlPath, "utf-8");

      const sections = extractQualitativeSections(htmlContent);

      expect(sections.size).toBeGreaterThan(0);
      expect(sections.has("BusinessRisksTextBlock")).toBe(true);

      const riskSection = sections.get("BusinessRisksTextBlock");
      expect(riskSection?.label).toBe("事業等のリスク");
      expect(riskSection?.text.length).toBeGreaterThan(50);
      expect(riskSection?.text).toContain("リスク");
    });
  });

  describe("TDnet Real XBRL ZIP (081220261102562860.zip)", () => {
    const zipPath = path.join(fixturesDir, "tdnet_sample_tanshin.zip");
    let zipBuffer: Buffer;

    beforeAll(() => {
      zipBuffer = fs.readFileSync(zipPath);
    });

    it("should extract accurate financial metrics from real TDnet earnings summary ZIP", () => {
      const metrics = extractFinancialMetricsFromZip(zipBuffer);

      // 実在企業の実データ数値（百万円単位から千円単位への正規化含む）
      expect(metrics.unit).toBe("千円");
      expect(metrics.revenue).toBeDefined();
      expect(metrics.revenue).toBe(17110000); // 最新通期予想売上 17,110 百万円 -> 17,110,000 千円
      expect(metrics.operatingIncome).toBe(6850000); // 最新通期予想営業利益 6,850 百万円 -> 6,850,000 千円
      expect(metrics.operatingCashFlow).toBeDefined(); // キャッシュフロー計算書から抽出
    });

    it("should extract qualitative text from real TDnet qualitative.htm inside ZIP", () => {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(zipBuffer);
      const qualEntry = zip.getEntry("XBRLData/Attachment/qualitative.htm");

      expect(qualEntry).toBeDefined();
      const qualHtml = qualEntry.getData().toString("utf-8");

      const { mdaText } = extractTdnetQualitativeHtml(qualHtml);
      expect(mdaText.length).toBeGreaterThan(100);
      expect(mdaText).toContain("経営成績");
    });

    it("should execute end-to-end ForensicAnalyzer on real TDnet ZIP", async () => {
      const mockClient = {
        systemOne: jest.fn().mockResolvedValue({
          answers: {
            risk_level: { choice: "normal" },
            flag_going_concern: { noul: 0.0 },
            flag_covenant: { noul: 0.0 },
            flag_negative_cf: { noul: 0.0 },
            flag_inventory_receivable: { noul: 0.1 },
            flag_impairment: { noul: 0.0 },
            flag_debt_pressure: { noul: 0.1 },
            flag_payout: { noul: 0.0 },
            flag_subsequent: { noul: 0.0 },
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
        }),
      } as unknown as TypeSafeClient;

      const analyzer = new ForensicAnalyzer({ client: mockClient });
      const result = await analyzer.analyzeZip(zipBuffer, true);

      expect(result.version).toBe(1);
      expect(result.metrics?.revenue).toBe(17110000);
      expect(result.metrics?.operatingIncome).toBe(6850000);
      expect(result.riskLevel).toBe("normal");
      expect(result.tags).toEqual([]);
      expect(mockClient.systemOne).toHaveBeenCalled();
    });
  });
});
