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
    expect(assessment.severity).toBe("critical");
  });

  describe("Quantitative Forensic Risk Assessment (Phase 1 Expansions)", () => {
    it("should detect accruals anomaly when accruals ratio exceeds threshold", () => {
      // 純利益 2,000,000千円、営業CF 200,000千円、総資産 10,000,000千円
      // accrualsRatio = (2,000,000 - 200,000) / 10,000,000 = 0.18 (18% > 15% -> Critical)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          netIncome: 2000000,
          operatingCashFlow: 200000,
          totalAssets: 10000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("accruals_anomaly");
      expect(assessment.severity).toBe("critical");
      expect(assessment.warnings.some((w) => w.includes("総資産アクルーアル比率が18.0%"))).toBe(true);
      expect(metrics.calculations?.accrualsRatio).toBe(0.18);
    });

    it("should skip accruals check for financial institutions", () => {
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        isFinancialIndustry: true,
        current: {
          netIncome: 2000000,
          operatingCashFlow: -5000000,
          totalAssets: 10000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).not.toContain("accruals_anomaly");
    });

    it("should detect DSRI spike (receivable surge)", () => {
      // 前期: 売上 10,000,000, 売上債権 1,000,000 (0.10)
      // 当期: 売上 10,000,000, 売上債権 1,600,000 (0.16)
      // DSRI = 0.16 / 0.10 = 1.60 (> 1.465 -> Critical)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "FY",
        current: {
          revenue: 10000000,
          tradeReceivables: 1600000,
        },
        prior: {
          revenue: 10000000,
          tradeReceivables: 1000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("inventory_receivable_surge");
      expect(assessment.severity).toBe("critical");
      expect(metrics.calculations?.dsri).toBe(1.6);
      expect(assessment.warnings.some((w) => w.includes("売上債権回転期間指数(DSRI)が前期比1.60倍"))).toBe(true);
    });

    it("should adjust DSRI threshold for quarterly disclosures with seasonal multiplier", () => {
      // DSRI = 1.30 (通期なら > 1.20 で Warning、四半期は 1.20 * 1.2 = 1.44 なので Warning にならない)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "Q1",
        current: {
          revenue: 10000000,
          tradeReceivables: 1300000,
        },
        prior: {
          revenue: 10000000,
          tradeReceivables: 1000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).not.toContain("inventory_receivable_surge");
      expect(metrics.calculations?.dsri).toBe(1.3);
    });

    it("should detect DSI bloat (inventory surge)", () => {
      // 前期: 売上 10,000,000, 棚卸資産 1,000,000 (0.10)
      // 当期: 売上 10,000,000, 棚卸資産 1,600,000 (0.16)
      // DSI = 0.16 / 0.10 = 1.60 (> 1.50 -> Critical)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "FY",
        current: {
          revenue: 10000000,
          inventories: 1600000,
        },
        prior: {
          revenue: 10000000,
          inventories: 1000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("inventory_receivable_surge");
      expect(assessment.severity).toBe("critical");
      expect(metrics.calculations?.dsiIndex).toBe(1.6);
    });

    it("should detect asset quality deterioration (AQI)", () => {
      // 総資産 10,000,000
      // 前期: 流動資産 6,000,000, 有形固定資産 3,000,000 -> その他資産 1,000,000 (比率 0.10)
      // 当期: 流動資産 5,000,000, 有形固定資産 2,500,000 -> その他資産 2,500,000 (比率 0.25)
      // AQI = 0.25 / 0.10 = 2.50 (> 1.254 -> Critical)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          totalAssets: 10000000,
          currentAssets: 5000000,
          propertyPlantAndEquipment: 2500000,
        },
        prior: {
          totalAssets: 10000000,
          currentAssets: 6000000,
          propertyPlantAndEquipment: 3000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("asset_quality_deterioration");
      expect(assessment.severity).toBe("critical");
      expect(metrics.calculations?.aqi).toBe(2.5);
    });

    it("should detect liquidity crunch and funding shock", () => {
      // 流動負債 5,000,000
      // 前期現預金 1,000,000 -> 当期現預金 300,000 (比率 0.06 < 0.08、営業CFマイナス -> Critical)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          cashAndDeposits: 300000,
          currentLiabilities: 5000000,
          operatingCashFlow: -50000,
        },
        prior: {
          cashAndDeposits: 1000000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("liquidity_crunch");
      expect(assessment.severity).toBe("critical");
      expect(metrics.calculations?.cashCoverage).toBe(0.06);
    });

    it("should detect equity erosion and deficit dividend", () => {
      // 利益剰余金 -100,000（赤字・欠損）、配当性向 30%（有配）
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          retainedEarnings: -100000,
          payoutRatio: 30.0,
          operatingCashFlow: 50000,
          investingCashFlow: -20000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("unsustainable_payout");
      expect(assessment.severity).toBe("critical");
      expect(assessment.warnings.some((w) => w.includes("利益剰余金マイナス（欠損）状態での配当実施"))).toBe(true);
    });

    it("should detect excessive leverage / low equity ratio", () => {
      // 純資産 800,000 / 総資産 10,000,000 = 8% (< 10% -> Warning)
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        current: {
          totalAssets: 10000000,
          netAssets: 800000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("equity_erosion");
      expect(assessment.severity).toBe("warning");
      expect(metrics.calculations?.equityRatio).toBe(0.08);
    });

    it("should correctly calculate DSRI/DSI when prior revenue is from corresponding prior interim period (Daido Signal model)", () => {
      // 大同信号の半期報告書（前年同中間期売上を取得した場合）
      // 当期売上: 12,386,342 (中間期6ヶ月)
      // 前期売上: 11,319,931 (前年中間期6ヶ月)
      // 当期債権: 12,663,707、前期末債権: 13,710,290
      // 当期在庫: 11,822,976、前期末在庫: 11,781,411
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "Q2",
        current: {
          revenue: 12386342,
          tradeReceivables: 12663707,
          inventories: 11822976,
          netIncome: 1118025,
          operatingCashFlow: 666000,
          totalAssets: 48305520,
          netAssets: 31198364,
        },
        prior: {
          revenue: 11319931,
          tradeReceivables: 13710290,
          inventories: 11781411,
          totalAssets: 50994045,
          netAssets: 32977146,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.severity).toBe("normal");
      expect(metrics.calculations?.dsri).toBe(0.844);
      expect(metrics.calculations?.dsiIndex).toBe(0.917);
    });

    it("should normalize quarterly/interim revenue against full-year prior revenue as fallback (Daido Signal fallback model)", () => {
      // 前年同期売上が取れず、前事業年度通期売上（25,695,648）しか取れなかった場合のフォールバックテスト
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "Q2",
        current: {
          revenue: 12386342,
          tradeReceivables: 12663707,
          inventories: 11822976,
          netIncome: 1118025,
          operatingCashFlow: 666000,
          totalAssets: 48305520,
          netAssets: 31198364,
        },
        prior: {
          revenue: 25695648,
          tradeReceivables: 13710290,
          inventories: 11781411,
          totalAssets: 50994045,
          netAssets: 32977146,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.severity).toBe("normal");
      expect(metrics.calculations?.dsri).toBe(0.958);
      expect(metrics.calculations?.dsiIndex).toBe(1.041);
    });

    it("should mitigate AQI from critical to warning when increase is predominantly driven by M&A goodwill (Shimadzu model)", () => {
      // 島津製作所の半期報告書実データモデル
      // 当期売上: 281,984,000 (6ヶ月)、前中間期売上: 256,342,000 (6ヶ月)
      // 投資CFマイナス1,340億円、のれんが約1,239億円急増（その他資産増加の89%を占める）
      const metrics: KeyFinancialMetrics = {
        unit: "千円",
        periodType: "Q2",
        current: {
          revenue: 281984000,
          tradeReceivables: 149037000,
          inventories: 169177000,
          totalAssets: 868074000,
          currentAssets: 473946000,
          propertyPlantAndEquipment: 137199000,
          investingCashFlow: -134012000,
          goodwill: 131255000,
        },
        prior: {
          revenue: 256342000,
          tradeReceivables: 156326000,
          inventories: 152098000,
          totalAssets: 737978000,
          currentAssets: 497728000,
          propertyPlantAndEquipment: 122815000,
          investingCashFlow: -8245000,
          goodwill: 7388000,
        },
      };

      const assessment = assessQuantitativeRisk(metrics);
      expect(assessment.detectedRedFlags).toContain("asset_quality_deterioration");
      // M&Aのれんが主因（寄与率50%以上）のため、Critical ではなく Warning に緩和される
      expect(assessment.severity).toBe("warning");
      expect(metrics.calculations?.dsri).toBe(0.867);
      expect(metrics.calculations?.dsiIndex).toBe(1.011);
      expect(metrics.calculations?.aqi).toBe(1.86);
      expect(assessment.warnings.some((w) => w.includes("M&A買収に伴うのれん計上要因：寄与率89%"))).toBe(true);
    });
  });
});
