import { DsiRule } from "../rules/dsi";
import { DsriRule } from "../rules/dsri";
import { AccrualsAnomalyRule } from "../rules/accruals";
import { extractFinancialMetricsFromZip } from "../financial_metrics_extractor";
import { KeyFinancialMetrics } from "../types";
import AdmZip from "adm-zip";

describe("Forensic Rules Enhancements (Precision Improvements)", () => {
  describe("DsiRule Materiality Filter", () => {
    const dsiRule = new DsiRule();

    it("should skip DSI surge alert when inventories are immaterial (< 1% of assets and revenue)", () => {
      // 売上10億円、総資産20億円、棚卸資産わずか200万円（0.1%）のIT企業（例: ZETA）
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          revenue: 1000000,
          totalAssets: 2000000,
          inventories: 2000, // 0.1%
        },
        prior: {
          revenue: 1000000,
          totalAssets: 2000000,
          inventories: 400, // 前期40万円 -> 5倍に急増
        },
      };

      const calculations = {};
      const result = dsiRule.evaluate(metrics, calculations);

      // 計算値は記録されるが、重要性基準によりフラグと深刻度はスキップされること
      expect(result.detectedRedFlags).not.toContain("inventory_receivable_surge");
      expect(result.severity).toBe("normal");
    });

    it("should trigger DSI surge alert when inventories are material (>= 1% of assets)", () => {
      // 売上10億円、総資産10億円、棚卸資産3億円（30%）の製造・流通企業
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          revenue: 1000000,
          totalAssets: 1000000,
          inventories: 300000,
        },
        prior: {
          revenue: 1000000,
          totalAssets: 1000000,
          inventories: 100000, // 3倍に急増
        },
      };

      const calculations = {};
      const result = dsiRule.evaluate(metrics, calculations);

      expect(result.detectedRedFlags).toContain("inventory_receivable_surge");
      expect(result.severity).toBe("critical");
      expect(result.warnings[0]).toContain("[大幅乖離]");
    });
  });

  describe("DsriRule Materiality Filter", () => {
    const dsriRule = new DsriRule();

    it("should skip DSRI alert when receivables are immaterial (< 2% of assets and revenue)", () => {
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          revenue: 1000000,
          totalAssets: 2000000,
          tradeReceivables: 5000, // 0.25%
        },
        prior: {
          revenue: 1000000,
          totalAssets: 2000000,
          tradeReceivables: 1000, // 5倍に急増
        },
      };

      const calculations = {};
      const result = dsriRule.evaluate(metrics, calculations);

      expect(result.detectedRedFlags).not.toContain("inventory_receivable_surge");
      expect(result.severity).toBe("normal");
    });
  });

  describe("AccrualsAnomalyRule Quarter/Interim & Working Capital Cycle Mitigation", () => {
    const accrualsRule = new AccrualsAnomalyRule();

    it("should mitigate accruals alert from critical to warning for construction/real estate working capital cycle", () => {
      // ゼネコン等（五洋建設など）: 中間期(Q2)で営業利益黒字、自己資本健全、債権・未成工事支出金比率が高い
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "Q2",
        current: {
          revenue: 100000000,
          operatingIncome: 5000000, // 営利黒字
          netIncome: 3000000,
          operatingCashFlow: -20000000, // 中間期支出先行による営業CF赤字
          totalAssets: 100000000,
          netAssets: 40000000, // 自己資本比率 40% (健全)
          tradeReceivables: 45000000, // 債権・未成工事 45% (高い)
        },
      };

      const calculations = {};
      const result = accrualsRule.evaluate(metrics, calculations);

      expect(result.detectedRedFlags).toContain("accruals_anomaly");
      // 従来の Critical ではなく Warning（乖離あり）に緩和されること
      expect(result.severity).toBe("warning");
      expect(result.warnings[0]).toContain("建設・開発等の仕入・工事代金回収サイクル先行型キャッシュ流出");
    });
  });

  describe("Financial Industry Detection by Metadata", () => {
    it("should detect financial industry by company keyword (e.g. 証券, リース, 銀行)", () => {
      const emptyZip = new AdmZip();
      emptyZip.addFile("dummy.txt", Buffer.from("test"));
      const zipBuffer = emptyZip.toBuffer();

      const secMetrics = extractFinancialMetricsFromZip(zipBuffer, {
        companyName: "日産証券グループ株式会社",
        code: "8705",
      });
      expect(secMetrics.isFinancialIndustry).toBe(true);

      const leaseMetrics = extractFinancialMetricsFromZip(zipBuffer, {
        companyName: "株式会社九州リースサービス",
      });
      expect(leaseMetrics.isFinancialIndustry).toBe(true);

      const trustMetrics = extractFinancialMetricsFromZip(zipBuffer, {
        title: "有価証券報告書（内国投資信託受益証券）",
      });
      expect(trustMetrics.isFinancialIndustry).toBe(true);
    });
  });
});
