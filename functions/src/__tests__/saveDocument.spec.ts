import "jest";
import { Readable, Writable } from "stream";

const mockWriteStream = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});

const mockFile = {
  createWriteStream: jest.fn().mockReturnValue(mockWriteStream),
};

const mockBucket = {
  file: jest.fn().mockReturnValue(mockFile),
};

const mockStorage = {
  bucket: jest.fn().mockReturnValue(mockBucket),
};

jest.mock("firebase-admin", () => ({
  storage: () => mockStorage,
}));

jest.mock("axios");
import axios from "axios";
import saveDocument from "../saveDocument";

describe("saveDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBucket.file.mockReturnValue(mockFile);
    mockFile.createWriteStream.mockReturnValue(new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    }));
  });

  it("should return early when snapshot has no document property", async () => {
    const snapshot = {
      data: () => ({}),
    } as any;

    const result = await saveDocument(snapshot);
    expect(result).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("should reject invalid/malicious document identifiers", async () => {
    const maliciousDocs = ["../evil", "doc/sub", "doc..pdf", "doc;id"];

    for (const doc of maliciousDocs) {
      const snapshot = {
        data: () => ({ document: doc }),
      } as any;

      const result = await saveDocument(snapshot);
      expect(result).toBe(false);
      expect(axios.get).not.toHaveBeenCalled();
    }
  });

  it("should download and save PDF successfully", async () => {
    const snapshot = {
      data: () => ({ document: "140120240530123456" }),
    } as any;

    const mockPdfStream = new Readable({
      read() {
        this.push(Buffer.from("%PDF-1.4 TDnet test"));
        this.push(null);
      },
    });

    (axios.get as jest.Mock).mockResolvedValue({
      data: mockPdfStream,
      status: 200,
    });

    const result = await saveDocument(snapshot);
    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalledWith(
      "https://www.release.tdnet.info/inbs/140120240530123456.pdf",
      expect.objectContaining({ responseType: "stream", timeout: 30000 })
    );
    expect(mockBucket.file).toHaveBeenCalledWith("disclosures/140120240530123456.pdf");
    expect(mockFile.createWriteStream).toHaveBeenCalledWith(
      expect.objectContaining({ gzip: true })
    );
  });

  it("should handle 404 from TDnet gracefully without throwing", async () => {
    const snapshot = {
      data: () => ({ document: "140120240530123456" }),
    } as any;

    const error404: any = new Error("Request failed with status code 404");
    error404.isAxiosError = true;
    error404.response = { status: 404 };
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

    (axios.get as jest.Mock).mockRejectedValue(error404);

    const result = await saveDocument(snapshot);
    expect(result).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("should retry on network error and succeed on subsequent attempt", async () => {
    const customSaveDoc = (await import("../saveDocument")).createSaveDocument("disclosures", {
      maxRetries: 3,
      initialDelayMs: 1,
    });

    const snapshot = {
      data: () => ({ document: "140120240530123456" }),
    } as any;

    const abortError = new Error("aborted");
    const mockPdfStream = new Readable({
      read() {
        this.push(Buffer.from("%PDF-1.4 TDnet test"));
        this.push(null);
      },
    });

    (axios.get as jest.Mock)
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce({
        data: mockPdfStream,
        status: 200,
      });

    const result = await customSaveDoc(snapshot);
    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all retries on persistent network error", async () => {
    const customSaveDoc = (await import("../saveDocument")).createSaveDocument("disclosures", {
      maxRetries: 3,
      initialDelayMs: 1,
    });

    const snapshot = {
      data: () => ({ document: "140120240530123456" }),
    } as any;

    const abortError = new Error("aborted");
    (axios.get as jest.Mock).mockRejectedValue(abortError);

    await expect(customSaveDoc(snapshot)).rejects.toThrow("aborted");
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it("should not retry non-retryable 4xx client errors (e.g. 403)", async () => {
    const customSaveDoc = (await import("../saveDocument")).createSaveDocument("disclosures", {
      maxRetries: 3,
      initialDelayMs: 1,
    });

    const snapshot = {
      data: () => ({ document: "140120240530123456" }),
    } as any;

    const error403: any = new Error("Request failed with status code 403");
    error403.isAxiosError = true;
    error403.response = { status: 403 };
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

    (axios.get as jest.Mock).mockRejectedValue(error403);

    const result = await customSaveDoc(snapshot);
    expect(result).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
