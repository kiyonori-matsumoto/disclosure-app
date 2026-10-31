import "jest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import iconv from "iconv-lite";
import { chromium } from "playwright";
import createCompanyDict, {
  parseCompanyDictCsv,
  downloadFile,
} from "../createCompanyDict";

jest.mock("playwright", () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const mockBucketFile = {
  save: jest.fn().mockResolvedValue(true),
};
const mockBucket = {
  file: jest.fn(() => mockBucketFile),
};

jest.mock("firebase-admin", () => ({
  storage: jest.fn(() => ({
    bucket: jest.fn((_bucketName?: string) => mockBucket),
  })),
}));

describe("createCompanyDict", () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "company-dict-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("parseCompanyDictCsv", () => {
    it("should correctly parse Shift_JIS csv and filter companies with code", () => {
      const csvString = [
        "ダウンロード日時: 2024-05-31",
        "ＥＤＩＮＥＴコード,提出者種別,上場区分,連結の有無,資本金,決算日,提出者名,提出者名（英字）,提出者名（カナ）,所在地,提出者業種,証券コード,提出者法人番号",
        "E00001,内国法人・組合,上場,有,1000000,3月31日,テスト株式会社,\"Test Co., Ltd.\",テストカブシキガイシャ,東京都千代田区,情報・通信業,12340,1234567890123",
        "E00002,内国法人・組合,非上場,無,500000,12月31日,非上場株式会社,\"Unlisted Co., Ltd.\",ヒジョウジョウカブシキガイシャ,大阪府大阪市,サービス業,,9876543210987",
        "E00003,内国法人・組合,上場,有,2000000,3月31日,サンプル株式会社,\"Sample Co., Ltd.\",サンプルカブシキガイシャ,東京都港区,電気機器,56780,1111222233334",
      ].join("\r\n");

      const buffer = iconv.encode(csvString, "Shift_JIS");
      const result = parseCompanyDictCsv(buffer);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        edinetCode: "E00001",
        classification: "上場",
        hasConsolidated: "有",
        capital: "1000000",
        closingDate: "3月31日",
        name: "テスト株式会社",
        nameEn: "Test Co., Ltd.",
        nameKana: "テストカブシキガイシャ",
        industory: "情報・通信業",
        code: "1234",
        corporateNumber: "1234567890123",
      });
      expect(result[1].code).toBe("5678");
    });
  });

  describe("downloadFile", () => {
    it("should launch chromium, download zip, and close browser", async () => {
      const saveAsMock = jest.fn().mockResolvedValue(undefined);
      const downloadEventMock = Promise.resolve({
        saveAs: saveAsMock,
      });

      const pageMock = {
        goto: jest.fn().mockResolvedValue(undefined),
        waitForEvent: jest.fn().mockReturnValue(downloadEventMock),
        click: jest.fn().mockResolvedValue(undefined),
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
      };

      const browserMock = {
        newPage: jest.fn().mockResolvedValue(pageMock),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (chromium.launch as jest.Mock).mockResolvedValue(browserMock);

      const destPath = path.join(tempDir, "edinet.zip");
      const result = await downloadFile(destPath);

      expect(result).toBe(destPath);
      expect(chromium.launch).toHaveBeenCalledTimes(1);
      expect(pageMock.goto).toHaveBeenCalledWith(
        "https://disclosure2.edinet-fsa.go.jp/weee0010.aspx",
        expect.any(Object)
      );
      expect(pageMock.click).toHaveBeenCalledWith("#GridContainerRow_0001 a");
      expect(saveAsMock).toHaveBeenCalledWith(destPath);
      expect(browserMock.close).toHaveBeenCalledTimes(1);
    });

    it("should close browser even if error occurs during navigation", async () => {
      const browserMock = {
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockRejectedValue(new Error("Network failed")),
        }),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (chromium.launch as jest.Mock).mockResolvedValue(browserMock);

      const destPath = path.join(tempDir, "edinet.zip");
      await expect(downloadFile(destPath)).rejects.toThrow("Network failed");
      expect(browserMock.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("createCompanyDict (lifecycle and cleanup)", () => {
    it("should clean up temporary files in finally block even on extraction failure", async () => {
      // Create mock zip and mock extraction that fails
      const browserMock = {
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(undefined),
          waitForEvent: jest.fn().mockResolvedValue({
            saveAs: jest.fn().mockImplementation(async (destPath: string) => {
              fs.writeFileSync(destPath, "invalid zip content");
            }),
          }),
          click: jest.fn().mockResolvedValue(undefined),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
        }),
        close: jest.fn().mockResolvedValue(undefined),
      };

      (chromium.launch as jest.Mock).mockResolvedValue(browserMock);

      await expect(createCompanyDict(undefined, undefined, tempDir)).rejects.toThrow();

      // Ensure no leftover edinet-*.zip in tempDir
      const filesAfter = fs.readdirSync(tempDir);
      expect(filesAfter.filter((f) => f.endsWith(".zip"))).toHaveLength(0);
    });
  });
});
