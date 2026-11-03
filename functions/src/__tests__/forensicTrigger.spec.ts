import "jest";
import AdmZip from "adm-zip";
import axios from "axios";
import {
  analyzeEdinetForensic,
  analyzeTdnetForensic,
} from "../forensicTrigger";

jest.mock("axios");
jest.mock("../lib/config", () => ({
  getEdinetApiKey: jest.fn().mockReturnValue("test-edinet-key"),
}));
jest.mock("../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../forensic/analyzer", () => {
  return {
    ForensicAnalyzer: jest.fn().mockImplementation(() => ({
      analyzeZip: jest.fn().mockResolvedValue({
        version: 1,
        analyzedAt: 1730642400,
        riskLevel: "critical",
        tags: ["going_concern", "negative_operating_cf"],
        causes: ["raw_material_energy"],
        metrics: { revenue: 1580000, operatingCashFlow: -280000, unit: "千円" },
        details: {
          blameAttribution: "external_macro_dominant",
          unfoundedOptimism: true,
          hasNegativeFactors: true,
        },
      }),
    })),
  };
});

describe("forensicTrigger", () => {
  let mockSnapshotRef: any;
  let mockZipBuffer: Buffer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSnapshotRef = {
      set: jest.fn().mockResolvedValue(true),
    };

    // テスト用の最小限のモック ZIP
    const zip = new AdmZip();
    zip.addFile(
      "XBRL/PublicDoc/test.htm",
      Buffer.from(
        '<ix:nonFraction name="jppfs_cor:NetSalesSummaryOfBusinessResults">1000000</ix:nonFraction>',
        "utf-8"
      )
    );
    mockZipBuffer = zip.toBuffer();
  });

  describe("analyzeEdinetForensic", () => {
    it("should process target EDINET document (docTypeCode 120), download zip, analyze, and save to firestore", async () => {
      const mockSnapshot = {
        id: "S100TEST",
        data: () => ({
          docID: "S100TEST",
          docTypeCode: "120", // 有価証券報告書
          filerName: "テスト株式会社",
        }),
        ref: mockSnapshotRef,
      } as any;

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mockZipBuffer,
        status: 200,
      });

      const handled = await analyzeEdinetForensic(mockSnapshot, {
        params: { docId: "S100TEST" },
      });

      expect(handled).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        "https://api.edinet-fsa.go.jp/api/v2/documents/S100TEST?type=1",
        expect.objectContaining({
          headers: { "Ocp-Apim-Subscription-Key": "test-edinet-key" },
          responseType: "arraybuffer",
        })
      );
      expect(mockSnapshotRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          forensic: expect.objectContaining({
            version: 1,
            riskLevel: expect.any(String),
            tags: expect.any(Array),
          }),
        }),
        { merge: true }
      );
    });

    it("should skip non-targeted EDINET document types (e.g. 350 大量保有)", async () => {
      const mockSnapshot = {
        id: "S100SKIP",
        data: () => ({
          docID: "S100SKIP",
          docTypeCode: "350",
          filerName: "テスト投資家",
        }),
        ref: mockSnapshotRef,
      } as any;

      const handled = await analyzeEdinetForensic(mockSnapshot, {
        params: { docId: "S100SKIP" },
      });

      expect(handled).toBe(false);
      expect(axios.get).not.toHaveBeenCalled();
      expect(mockSnapshotRef.set).not.toHaveBeenCalled();
    });

    it("should skip already analyzed EDINET document", async () => {
      const mockSnapshot = {
        id: "S100DONE",
        data: () => ({
          docID: "S100DONE",
          docTypeCode: "120",
          forensic: { version: 1, riskLevel: "normal" },
        }),
        ref: mockSnapshotRef,
      } as any;

      const handled = await analyzeEdinetForensic(mockSnapshot, {
        params: { docId: "S100DONE" },
      });

      expect(handled).toBe(true);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe("analyzeTdnetForensic", () => {
    it("should process TDnet document with xbrl zip, analyze, and save to firestore", async () => {
      const mockSnapshot = {
        id: "1507204500129",
        data: () => ({
          title: "2026年3月期 決算短信〔IFRS〕(連結)",
          company: "トヨタ自動車",
          xbrl: "081220261102562860.zip",
        }),
        ref: mockSnapshotRef,
      } as any;

      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: mockZipBuffer,
        status: 200,
      });

      const handled = await analyzeTdnetForensic(mockSnapshot);

      expect(handled).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        "https://www.release.tdnet.info/inbs/081220261102562860.zip",
        expect.objectContaining({
          responseType: "arraybuffer",
        })
      );
      expect(mockSnapshotRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          forensic: expect.objectContaining({
            version: 1,
            riskLevel: expect.any(String),
          }),
        }),
        { merge: true }
      );
    });

    it("should skip TDnet document without xbrl property", async () => {
      const mockSnapshot = {
        id: "1507204500130",
        data: () => ({
          title: "自己株式取得に係る事項の決定に関するお知らせ",
          company: "テスト企業",
        }),
        ref: mockSnapshotRef,
      } as any;

      const handled = await analyzeTdnetForensic(mockSnapshot);

      expect(handled).toBe(false);
      expect(axios.get).not.toHaveBeenCalled();
      expect(mockSnapshotRef.set).not.toHaveBeenCalled();
    });
  });
});
