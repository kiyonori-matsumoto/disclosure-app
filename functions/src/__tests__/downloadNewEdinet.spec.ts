import "jest";
import { Readable, Writable } from "stream";

// Mock firebase-admin before importing module
const mockFile = {
  exists: jest.fn(),
  createWriteStream: jest.fn(),
  getSignedUrl: jest.fn(),
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

jest.mock("firebase-functions/v1", () => ({
  config: () => ({
    edinet: {
      apikey: "test-api-key",
    },
  }),
}));

jest.mock("axios");
import axios from "axios";
import getDownloadUrlEdinet from "../downloadNewEdinet";

describe("getDownloadUrlEdinet", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBucket.file.mockReturnValue(mockFile);

    req = {
      method: "GET",
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("should return 405 if method is not GET", async () => {
    req.method = "POST";
    await getDownloadUrlEdinet(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("should return 400 if docId is missing", async () => {
    await getDownloadUrlEdinet(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("docId is required");
  });

  it("should reject path traversal attempts with 400", async () => {
    const maliciousDocIds = [
      "../secret",
      "..\\secret",
      "folder/file",
      "doc..id",
      "doc;id",
      "doc id",
      "../../etc/passwd",
    ];

    for (const docId of maliciousDocIds) {
      jest.clearAllMocks();
      req.query = { docId };
      await getDownloadUrlEdinet(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith("Invalid docId format");
    }
  });

  it("should return existing signed URL if file already exists in storage", async () => {
    req.query = { docId: "S100TEST" };
    mockFile.exists.mockResolvedValue([true]);
    mockFile.getSignedUrl.mockResolvedValue(["https://signed-url.example.com"]);

    await getDownloadUrlEdinet(req, res);

    expect(mockBucket.file).toHaveBeenCalledWith("edinets/S100TEST.pdf");
    expect(mockFile.exists).toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      signedUrl: "https://signed-url.example.com",
    });
  });

  it("should download from EDINET and save to storage if file does not exist", async () => {
    req.query = { docId: "S100TEST" };
    mockFile.exists.mockResolvedValue([false]);

    const mockStream = new Readable({
      read() {
        this.push(Buffer.from("%PDF-1.4 test"));
        this.push(null);
      },
    });

    const mockWriter = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    mockFile.createWriteStream.mockReturnValue(mockWriter);
    (axios.get as jest.Mock).mockResolvedValue({
      headers: { "content-type": "application/pdf" },
      data: mockStream,
    });
    mockFile.getSignedUrl.mockResolvedValue(["https://signed-url.example.com"]);

    await getDownloadUrlEdinet(req, res);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("documents/S100TEST?type=2"),
      expect.objectContaining({ responseType: "stream", timeout: 30000 })
    );
    expect(mockFile.getSignedUrl).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      signedUrl: "https://signed-url.example.com",
    });
  });

  it("should return 404 if EDINET response is not a PDF", async () => {
    req.query = { docId: "S100TEST" };
    mockFile.exists.mockResolvedValue([false]);

    (axios.get as jest.Mock).mockResolvedValue({
      headers: { "content-type": "application/json" },
      data: new Readable({
        read() {
          this.push(null);
        },
      }),
    });

    await getDownloadUrlEdinet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("not found");
  });
});
