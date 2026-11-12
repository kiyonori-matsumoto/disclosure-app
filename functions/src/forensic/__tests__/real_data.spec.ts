import "jest";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { extractQualitativeSections, extractTdnetQualitativeHtml } from "../extractor";
import {
  assessQuantitativeRisk,
  extractFinancialMetricsFromZip,
} from "../financial_metrics_extractor";
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

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("J-GAAP");
      expect(metrics.periodType).toBe("FY");
      expect(metrics.isFinancialIndustry).toBe(false);

      // 下位互換プロパティ（当期実績値）
      expect(metrics.revenue).toBe(15556680); // 売上高: 15,556,680 千円
      expect(metrics.operatingIncome).toBe(6161812); // 営業利益: 6,161,812 千円
      expect(metrics.netIncome).toBe(4374619); // 当期純利益: 4,374,619 千円
      expect(metrics.operatingCashFlow).toBe(4252833); // 営業CF: 4,252,833 千円
      expect(metrics.payoutRatio).toBe(66.8); // 当期実績配当性向: 66.8%
      expect(metrics.totalAssets).toBe(16265000); // 総資産: 16,265,000 千円

      // フェーズ1追加: 当期（Current）の全15科目
      const cur = metrics.current!;
      expect(cur.revenue).toBe(15556680);
      expect(cur.operatingIncome).toBe(6161812);
      expect(cur.netIncome).toBe(4374619);
      expect(cur.operatingCashFlow).toBe(4252833);
      expect(cur.payoutRatio).toBe(66.8);
      expect(cur.totalAssets).toBe(16265000);
      expect(cur.tradeReceivables).toBe(1915606); // 売上債権: 1,915,606 千円
      expect(cur.inventories).toBe(26287); // 棚卸資産（商品 2,263 + 仕掛品 24,024）: 26,287 千円
      expect(cur.cashAndDeposits).toBe(7663635); // 現金及び預金: 7,663,635 千円
      expect(cur.currentAssets).toBe(9792784); // 流動資産合計: 9,792,784 千円
      expect(cur.propertyPlantAndEquipment).toBe(4168925); // 有形固定資産: 4,168,925 千円
      expect(cur.currentLiabilities).toBe(3360749); // 流動負債合計: 3,360,749 千円
      expect(cur.netAssets).toBe(12803760); // 純資産合計: 12,803,760 千円
      expect(cur.retainedEarnings).toBe(11476066); // 利益剰余金: 11,476,066 千円
      expect(cur.investingCashFlow).toBe(-678482); // 投資CF: -678,482 千円

      // フェーズ1追加: 前期（Prior）の全15科目
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(14510945);
      expect(pri.operatingIncome).toBe(5978600);
      expect(pri.netIncome).toBe(4130091);
      expect(pri.operatingCashFlow).toBe(4395202);
      expect(pri.payoutRatio).toBe(50.8);
      expect(pri.totalAssets).toBe(16149000);
      expect(pri.tradeReceivables).toBe(1877534);
      expect(pri.inventories).toBe(40051); // 棚卸資産（商品 10,367 + 仕掛品 29,684）: 40,051 千円
      expect(pri.cashAndDeposits).toBe(8191258);
      expect(pri.currentAssets).toBe(10200841);
      expect(pri.propertyPlantAndEquipment).toBe(3594640);
      expect(pri.currentLiabilities).toBe(3592701);
      expect(pri.netAssets).toBe(12487074);
      expect(pri.retainedEarnings).toBe(11379746);
      expect(pri.investingCashFlow).toBe(-231097);

      // 定量リスク判定・計算指標の検証
      const assessment = assessQuantitativeRisk(metrics);

      expect(assessment.severity).toBe("normal");
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.warnings).toEqual([]);

      // 計算されたフォレンジック指標の検証
      expect(metrics.calculations?.accrualsRatio).toBeCloseTo(0.0075, 4); // アクルーアル 0.75% (健全)
      expect(metrics.calculations?.dsri).toBeCloseTo(0.952, 3); // DSRI 0.95倍 (回収サイト安定)
      expect(metrics.calculations?.dsiIndex).toBeCloseTo(0.612, 3); // DSI 0.61倍 (在庫圧縮)
      expect(metrics.calculations?.fcf).toBe(3574351); // FCF 35.7億円のプラス
      expect(metrics.calculations?.cashCoverage).toBeCloseTo(2.28, 2); // 流動負債比で2.28倍の手元現金
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.787, 3); // 自己資本比率 78.7%
    });

    it("should extract qualitative text from real TDnet qualitative.htm inside ZIP", () => {
      const zip = new AdmZip(zipBuffer);
      const qualEntry = zip.getEntry("XBRLData/Attachment/qualitative.htm");

      expect(qualEntry).toBeDefined();
      const qualHtml = qualEntry!.getData().toString("utf-8");

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
      expect(result.metrics?.revenue).toBe(15556680);
      expect(result.metrics?.operatingIncome).toBe(6161812);
      expect(result.riskLevel).toBe("normal");
      expect(result.tags).toEqual([]);
      expect(mockClient.systemOne).toHaveBeenCalled();
    });
  });

  describe("TDnet IFRS Real XBRL ZIP (FOOD & LIFE COMPANIES / 3563)", () => {
    const ifrsZipPath = path.join(fixturesDir, "tdnet_sample_tanshin_ifrs.zip");
    let ifrsZipBuffer: Buffer;

    beforeAll(() => {
      ifrsZipBuffer = fs.readFileSync(ifrsZipPath);
    });

    it("should extract accurate IFRS financial metrics from real earnings summary ZIP", () => {
      const metrics = extractFinancialMetricsFromZip(ifrsZipBuffer);

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("IFRS");
      expect(metrics.periodType).toBe("FY");
      expect(metrics.isFinancialIndustry).toBe(false);

      // 下位互換プロパティ（当期実績値）
      expect(metrics.revenue).toBe(515334000); // 売上高: 515,334,000 千円 (約5,153億円)
      expect(metrics.operatingIncome).toBe(51506000); // 営業利益: 51,506,000 千円 (約515億円)
      expect(metrics.netIncome).toBe(35380000); // 親会社帰属純利益: 35,380,000 千円 (約353億円)
      expect(metrics.operatingCashFlow).toBe(87474000); // 営業CF: 87,474,000 千円 (約874億円)
      expect(metrics.payoutRatio).toBe(12.8); // 配当性向: 12.8%
      expect(metrics.totalAssets).toBe(458126000); // 総資産: 458,126,000 千円 (約4,581億円)

      // 当期（Current）の全15科目
      const cur = metrics.current!;
      expect(cur.revenue).toBe(515334000);
      expect(cur.operatingIncome).toBe(51506000);
      expect(cur.netIncome).toBe(35380000);
      expect(cur.operatingCashFlow).toBe(87474000);
      expect(cur.payoutRatio).toBe(12.8);
      expect(cur.totalAssets).toBe(458126000);
      expect(cur.tradeReceivables).toBe(20449000); // 営業債権及びその他の債権: 20,449,000 千円
      expect(cur.inventories).toBe(12416000); // 棚卸資産: 12,416,000 千円
      expect(cur.cashAndDeposits).toBe(73336000); // 現金及び現金同等物: 73,336,000 千円
      expect(cur.currentAssets).toBe(118591000); // 流動資産合計: 118,591,000 千円
      expect(cur.propertyPlantAndEquipment).toBe(231976000); // 有形固定資産: 231,976,000 千円
      expect(cur.currentLiabilities).toBe(119433000); // 流動負債合計: 119,433,000 千円
      expect(cur.netAssets).toBe(131877000); // 親会社所有者帰属持分: 131,877,000 千円
      expect(cur.retainedEarnings).toBe(116772000); // 利益剰余金: 116,772,000 千円
      expect(cur.investingCashFlow).toBe(-41219000); // 投資活動CF: -41,219,000 千円

      // 前期（Prior）の全15科目
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(406149000);
      expect(pri.operatingIncome).toBe(35036000);
      expect(pri.netIncome).toBe(22937000);
      expect(pri.operatingCashFlow).toBe(64429000);
      expect(pri.payoutRatio).toBe(17.3);
      expect(pri.totalAssets).toBe(398596000);
      expect(pri.tradeReceivables).toBe(15284000);
      expect(pri.inventories).toBe(10242000);
      expect(pri.cashAndDeposits).toBe(58822000);
      expect(pri.currentAssets).toBe(88396000);
      expect(pri.propertyPlantAndEquipment).toBe(203820000);
      expect(pri.currentLiabilities).toBe(84857000);
      expect(pri.netAssets).toBe(97869000);
      expect(pri.retainedEarnings).toBe(85355000);
      expect(pri.investingCashFlow).toBe(-25436000);

      // 定量リスク判定・計算指標の検証
      const assessment = assessQuantitativeRisk(metrics);

      expect(assessment.severity).toBe("normal");
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.warnings).toEqual([]);

      // 計算されたフォレンジック指標の検証
      expect(metrics.calculations?.accrualsRatio).toBeCloseTo(-0.1137, 4); // アクルーアル マイナス（健全な現金創出）
      expect(metrics.calculations?.dsri).toBeCloseTo(1.054, 3); // DSRI 1.05倍 (回転期間安定)
      expect(metrics.calculations?.dsiIndex).toBeCloseTo(0.955, 3); // DSI 0.95倍 (在庫回転良好)
      expect(metrics.calculations?.aqi).toBeCloseTo(0.880, 3); // AQI 0.88倍 (資産の質安定)
      expect(metrics.calculations?.fcf).toBe(46255000); // FCF +462.5億円の大幅プラス
      expect(metrics.calculations?.cashCoverage).toBeCloseTo(0.614, 3); // 流動負債に対し約61%の手元流動性
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.288, 3); // 親会社帰属自己資本比率 28.8%
    });
  });

  describe("TDnet Quarterly Real XBRL ZIP (Edion / 2730 / Q2)", () => {
    const q2ZipPath = path.join(fixturesDir, "tdnet_sample_edion_q2.zip");
    let q2ZipBuffer: Buffer;

    beforeAll(() => {
      q2ZipBuffer = fs.readFileSync(q2ZipPath);
    });

    it("should extract accurate quarterly financial metrics and apply Q2 annualization", () => {
      const metrics = extractFinancialMetricsFromZip(q2ZipBuffer);

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("J-GAAP");
      expect(metrics.periodType).toBe("Q2"); // 第2四半期累計期間を正常検知
      expect(metrics.isFinancialIndustry).toBe(false);

      // 当期実績値（Current）
      const cur = metrics.current!;
      expect(cur.revenue).toBe(416367000); // 売上高: 416,367,000 千円 (4,163億円)
      expect(cur.operatingIncome).toBe(23848000); // 営業利益: 23,848,000 千円 (238億円)
      expect(cur.netIncome).toBe(16253000); // 四半期純利益: 16,253,000 千円 (162億円)
      expect(cur.operatingCashFlow).toBe(31305000); // 営業CF: 31,305,000 千円 (313億円)
      expect(cur.totalAssets).toBe(430611000); // 総資産: 430,611,000 千円
      expect(cur.tradeReceivables).toBe(36240000); // 売掛金及び契約資産: 36,240,000 千円
      expect(cur.inventories).toBe(122520000); // 商品: 122,520,000 千円
      expect(cur.cashAndDeposits).toBe(8981000); // 現金及び預金: 8,981,000 千円
      expect(cur.currentAssets).toBe(183228000); // 流動資産合計: 183,228,000 千円
      expect(cur.propertyPlantAndEquipment).toBe(173150000); // 有形固定資産: 173,150,000 千円
      expect(cur.currentLiabilities).toBe(112719000); // 流動負債合計: 112,719,000 千円
      expect(cur.netAssets).toBe(249953000); // 純資産合計: 249,953,000 千円
      expect(cur.retainedEarnings).toBe(162725000); // 利益剰余金: 162,725,000 千円
      expect(cur.investingCashFlow).toBe(-8304000); // 投資活動CF: -8,304,000 千円

      // 前年同期実績値（Prior）
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(385668000);
      expect(pri.operatingIncome).toBe(13787000);
      expect(pri.netIncome).toBe(9336000);
      expect(pri.operatingCashFlow).toBe(20438000);
      expect(pri.totalAssets).toBe(433550000);
      expect(pri.tradeReceivables).toBe(43573000);
      expect(pri.inventories).toBe(116122000);
      expect(pri.cashAndDeposits).toBe(8958000);
      expect(pri.currentAssets).toBe(189162000);
      expect(pri.propertyPlantAndEquipment).toBe(173147000);
      expect(pri.currentLiabilities).toBe(128534000);
      expect(pri.netAssets).toBe(234957000);
      expect(pri.retainedEarnings).toBe(149087000);
      expect(pri.investingCashFlow).toBe(-7353000);

      // 定量リスク判定・計算指標の検証
      const assessment = assessQuantitativeRisk(metrics);

      expect(assessment.severity).toBe("normal");
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.warnings).toEqual([]);

      // 四半期年換算（Q2は×2）されたフォレンジック指標の検証
      // (16253000 - 31305000) * 2 / 430611000 = -15052000 * 2 / 430611000 = -0.0699 (-7.0%)
      expect(metrics.calculations?.accrualsRatio).toBeCloseTo(-0.0699, 4);
      expect(metrics.calculations?.dsri).toBeCloseTo(0.770, 3); // DSRI良好
      expect(metrics.calculations?.dsiIndex).toBeCloseTo(0.977, 3); // DSI良好
      expect(metrics.calculations?.aqi).toBeCloseTo(1.049, 3); // AQI安定
      expect(metrics.calculations?.fcf).toBe(23001000); // FCF +230億円
      expect(metrics.calculations?.cashCoverage).toBeCloseTo(0.0797, 4); // 手元現金比率
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.5805, 4); // 自己資本比率 58.1%
    });
  });

  describe("EDINET Securities Report Real XBRL ZIP (Insource / 6200 / Yuho)", () => {
    const yuhoZipPath = path.join(fixturesDir, "edinet_sample_yuho.zip");
    let yuhoZipBuffer: Buffer;

    beforeAll(() => {
      yuhoZipBuffer = fs.readFileSync(yuhoZipPath);
    });

    it("should extract accurate financial metrics from real EDINET securities report ZIP", () => {
      const metrics = extractFinancialMetricsFromZip(yuhoZipBuffer);

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("J-GAAP");
      expect(metrics.periodType).toBe("FY");
      expect(metrics.isFinancialIndustry).toBe(false);

      // 当期実績値（Current: インソース有報 連結）
      const cur = metrics.current!;
      expect(cur.revenue).toBe(14510945); // 連結売上高: 14,510,945 千円 (約145億円)
      expect(cur.operatingIncome).toBe(5978600); // 連結営業利益: 5,978,600 千円 (約59.8億円)
      expect(cur.netIncome).toBe(4130091); // 連結純利益: 4,130,091 千円 (約41.3億円)
      expect(cur.operatingCashFlow).toBe(4395202); // 連結営業CF: 4,395,202 千円
      expect(cur.payoutRatio).toBe(50.8); // 連結配当性向: 50.8% (25円 / 連結EPS 49.20円)
      expect(cur.totalAssets).toBe(16149441); // 連結総資産: 16,149,441 千円 (約161億円)
      expect(cur.tradeReceivables).toBe(1877534); // 連結売上債権: 1,877,534 千円
      expect(cur.inventories).toBe(40051); // 連結棚卸資産: 40,051 千円
      expect(cur.cashAndDeposits).toBe(8191258); // 連結現預金: 8,191,258 千円
      expect(cur.currentAssets).toBe(10200841); // 連結流動資産: 10,200,841 千円
      expect(cur.propertyPlantAndEquipment).toBe(3594640); // 連結有形固定資産: 3,594,640 千円
      expect(cur.currentLiabilities).toBe(3592701); // 連結流動負債: 3,592,701 千円
      expect(cur.netAssets).toBe(12487074); // 連結純資産: 12,487,074 千円
      expect(cur.retainedEarnings).toBe(11379746); // 連結利益剰余金: 11,379,746 千円
      expect(cur.investingCashFlow).toBe(-231097); // 投資活動CF: -231,097 千円

      // 前期実績値（Prior: インソース有報 連結前期）
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(12474662); // 連結売上高: 12,474,662 千円
      expect(pri.operatingIncome).toBe(4937091); // 連結営業利益: 4,937,091 千円
      expect(pri.netIncome).toBe(3355877); // 連結純利益: 3,355,877 千円
      expect(pri.operatingCashFlow).toBe(4032447); // 連結営業CF: 4,032,447 千円
      expect(pri.payoutRatio).toBe(50.0); // 前期連結配当性向: 50.0% (20円 / 連結EPS 39.98円)
      expect(pri.totalAssets).toBe(13177848); // 連結総資産: 13,177,848 千円
      expect(pri.tradeReceivables).toBe(1540922);
      expect(pri.inventories).toBe(57020);
      expect(pri.cashAndDeposits).toBe(5705369);
      expect(pri.currentAssets).toBe(7405642);
      expect(pri.propertyPlantAndEquipment).toBe(3604822);
      expect(pri.currentLiabilities).toBe(3199330);
      expect(pri.netAssets).toBe(9935479);
      expect(pri.retainedEarnings).toBe(8927868);
      expect(pri.investingCashFlow).toBe(-447594);

      // 定量リスク判定・計算指標の検証
      const assessment = assessQuantitativeRisk(metrics);

      expect(assessment.severity).toBe("normal");
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.warnings).toEqual([]);

      // 計算されたフォレンジック指標の検証
      // (4130091 - 4395202) / 16149441 = -265111 / 16149441 = -0.0164 (-1.64%)
      expect(metrics.calculations?.accrualsRatio).toBeCloseTo(-0.0164, 4);
      expect(metrics.calculations?.dsri).toBeCloseTo(1.047, 3);
      expect(metrics.calculations?.dsiIndex).toBeCloseTo(0.604, 3);
      expect(metrics.calculations?.fcf).toBe(4164105); // 営業CF 43.9億 - 投資CF 2.3億 = +41.6億円
      expect(metrics.calculations?.cashCoverage).toBeCloseTo(2.28, 2); // 流動負債の2.28倍の手元資金
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.7732, 4); // 自己資本比率 77.3%
    });
  });

  describe("EDINET Bank Real XBRL ZIP (Mizuho Bank / E03532 / Megabank Yuho)", () => {
    const bankZipPath = path.join(fixturesDir, "edinet_sample_bank_mizuho.zip");
    let bankZipBuffer: Buffer;

    beforeAll(() => {
      bankZipBuffer = fs.readFileSync(bankZipPath);
    });

    it("should accurately extract megabank financial metrics and handle financial industry exclusion", () => {
      const metrics = extractFinancialMetricsFromZip(bankZipBuffer);

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("J-GAAP");
      expect(metrics.periodType).toBe("FY");
      expect(metrics.isFinancialIndustry).toBe(true); // 銀行業フラグを正常検知

      // 当期実績値（Current: みずほ銀行 2026年3月期有報 連結）
      const cur = metrics.current!;
      expect(cur.revenue).toBe(7993235000); // 連結経常収益（OrdinaryIncomeBNK）: 7,993,235,000 千円 (約7.99兆円)
      expect(cur.netIncome).toBe(1033486000); // 連結当期純利益: 1,033,486,000 千円 (約1.03兆円)
      expect(cur.operatingCashFlow).toBe(-5044304000); // 営業CF: -5,044,304,000 千円 (-5.04兆円)
      expect(cur.investingCashFlow).toBe(-6686166000); // 投資CF: -6,686,166,000 千円 (-6.69兆円)
      expect(cur.payoutRatio).toBe(58.1); // 連結配当性向: 58.1% (37,149円 / 連結EPS 63,986.73円)
      expect(cur.totalAssets).toBe(271746785000); // 連結総資産: 271,746,785,000 千円 (約272兆円)
      expect(cur.cashAndDeposits).toBe(60323652000); // 連結BS現金預け金: 60,323,652,000 千円 (約60.3兆円)
      expect(cur.propertyPlantAndEquipment).toBe(977373000); // 連結有形固定資産: 977,373,000 千円 (約9,774億円)
      expect(cur.netAssets).toBe(9356566000); // 連結純資産合計: 9,356,566,000 千円 (約9.36兆円)
      expect(cur.retainedEarnings).toBe(4520771000); // 連結利益剰余金: 4,520,771,000 千円 (約4.52兆円)

      // 銀行業には売掛金・棚卸資産・流動資産・流動負債は存在しない
      expect(cur.tradeReceivables).toBeUndefined();
      expect(cur.inventories).toBeUndefined();
      expect(cur.currentAssets).toBeUndefined();
      expect(cur.currentLiabilities).toBeUndefined();

      // 前期実績値（Prior: みずほ銀行 連結前期）
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(8064837000); // 連結経常収益: 8,064,837,000 千円 (約8.06兆円)
      expect(pri.netIncome).toBe(768151000); // 連結当期純利益: 768,151,000 千円 (約7,681億円)
      expect(pri.operatingCashFlow).toBe(-4547005000); // 営業CF: -4,547,005,000 千円 (-4.55兆円)
      expect(pri.totalAssets).toBe(256099451000); // 連結総資産: 256,099,451,000 千円 (約256兆円)
      expect(pri.cashAndDeposits).toBe(70405669000); // 前期連結BS現金預け金: 70,405,669,000 千円 (約70.4兆円)
      expect(pri.netAssets).toBe(8470987000); // 連結純資産合計: 8,470,987,000 千円 (約8.47兆円)

      // 定量リスク判定・計算指標の検証
      const assessment = assessQuantitativeRisk(metrics);

      // 銀行特有の営業CFマイナスや預金流出入によるFCFマイナスで誤爆しないことを検証
      expect(assessment.severity).toBe("normal");
      expect(assessment.detectedRedFlags).toEqual([]);
      expect(assessment.warnings).toEqual([]);

      // 金融業向け計算指標の検証（DSRI/DSI/AQI等は除外され、自己資本比率等は計算）
      expect(metrics.calculations?.dsri).toBeUndefined();
      expect(metrics.calculations?.dsiIndex).toBeUndefined();
      expect(metrics.calculations?.aqi).toBeUndefined();
      expect(metrics.calculations?.cashCoverage).toBeUndefined();
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.0344, 4); // 銀行の連結自己資本比率 約3.44%
    });
  });

  describe("TDnet Real XBRL ZIP with Going Concern (Future Link Network / 9241 / GC)", () => {
    const gcZipPath = path.join(fixturesDir, "tdnet_sample_9241_gc.zip");
    let gcZipBuffer: Buffer;

    beforeAll(() => {
      gcZipBuffer = fs.readFileSync(gcZipPath);
    });

    it("should extract financial metrics and trigger critical equity erosion and negative CF alerts", () => {
      const metrics = extractFinancialMetricsFromZip(gcZipBuffer);

      // 基本情報
      expect(metrics.unit).toBe("千円");
      expect(metrics.standard).toBe("J-GAAP");
      expect(metrics.periodType).toBe("FY");
      expect(metrics.isFinancialIndustry).toBe(false);

      // 当期実績値（赤字・財務毀損）
      const cur = metrics.current!;
      expect(cur.revenue).toBe(1512025); // 売上高: 1,512,025 千円
      expect(cur.operatingIncome).toBe(-82695); // 営業赤字: -82,695 千円
      expect(cur.netIncome).toBe(-255084); // 最終赤字: -255,084 千円
      expect(cur.operatingCashFlow).toBe(-214978); // 営業CF赤字: -214,978 千円
      expect(cur.totalAssets).toBe(722000); // 総資産: 722,000 千円
      expect(cur.netAssets).toBe(66857); // 純資産: 66,857 千円 (約6,685万円まで急減)
      expect(cur.retainedEarnings).toBe(-456980); // 利益剰余金欠損: -456,980 千円

      // 前期実績値
      const pri = metrics.prior!;
      expect(pri.revenue).toBe(1544788);
      expect(pri.operatingIncome).toBe(-17686);
      expect(pri.netIncome).toBe(28558);
      expect(pri.operatingCashFlow).toBe(131738);
      expect(pri.totalAssets).toBe(994000);
      expect(pri.netAssets).toBe(300039); // 前期純資産: 300,039 千円

      // 定量リスク判定
      const assessment = assessQuantitativeRisk(metrics);

      expect(assessment.severity).toBe("critical");
      expect(assessment.detectedRedFlags).toContain("negative_operating_cf");
      expect(assessment.detectedRedFlags).toContain("equity_erosion");
      expect(assessment.warnings).toContain(
        "[大幅乖離] 債務超過または累積赤字下での純資産77.7%急減"
      );
      expect(assessment.warnings).toContain(
        "[乖離あり] 営業活動によるキャッシュ・フローがマイナス（-214,978千円）"
      );

      // 指標計算値の検証
      expect(metrics.calculations?.equityRatio).toBeCloseTo(0.0926, 4); // 自己資本比率 9.26%
      expect(metrics.calculations?.netAssetsDropRate).toBeCloseTo(-0.7772, 4); // 純資産 -77.7% 毀損
      expect(metrics.calculations?.fcf).toBe(-254590); // FCF △2.5億円の赤字
    });

    it("should extract going concern text to Jev System One and trigger critical risk with going_concern tag", async () => {
      let passedNotesText = "";

      const mockClient = {
        systemOne: jest.fn().mockImplementation(({ state }) => {
          if (state.role.includes("Financial")) {
            passedNotesText = state.extracted_notes || "";
            const hasGc = passedNotesText.includes("継続企業の前提");
            return Promise.resolve({
              answers: {
                risk_level: { choice: hasGc ? "critical" : "normal" },
                flag_going_concern: { noul: hasGc ? 0.95 : 0.0 },
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
              has_negative_factors: { noul: 0.8 },
              blame_attribution: { choice: "internal_acknowledged" },
              unfounded_optimism: { noul: 0.2 },
              is_risk_materialized: { noul: 0.5 },
              cause_fx: { noul: 0.0 },
              cause_raw_material: { noul: 0.0 },
              cause_weather: { noul: 0.0 },
              cause_geopolitics: { noul: 0.0 },
              cause_upfront: { noul: 0.7 },
              cause_weak_sales: { noul: 0.6 },
              cause_price_pass: { noul: 0.0 },
            },
          });
        }),
      } as unknown as TypeSafeClient;

      const analyzer = new ForensicAnalyzer({ client: mockClient });
      const result = await analyzer.analyzeZip(gcZipBuffer, true);

      // Jev に渡された注記テキストの検証
      expect(passedNotesText).toContain("継続企業の前提に関する重要事象等");
      expect(passedNotesText).toContain("重要な疑義");

      // 判定結果の検証
      expect(result.riskLevel).toBe("critical");
      expect(result.tags).toContain("going_concern");
      expect(result.tags).toContain("equity_erosion");
      expect(result.tags).toContain("negative_operating_cf");
    });
  });
});
