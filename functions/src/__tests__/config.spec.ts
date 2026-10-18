import "jest";

// Mock fs before importing config
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock firebase-functions/v1
const mockV1Config = jest.fn();
jest.mock("firebase-functions/v1", () => ({
  config: () => mockV1Config(),
}));

import * as fs from "fs";
import { getEdinetApiKey } from "../lib/config";

describe("getEdinetApiKey", () => {
  const originalEnv = process.env.EDINET_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EDINET_API_KEY;
    mockV1Config.mockReturnValue({});
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.EDINET_API_KEY = originalEnv;
    } else {
      delete process.env.EDINET_API_KEY;
    }
  });

  it("should prioritize process.env.EDINET_API_KEY", () => {
    process.env.EDINET_API_KEY = "env-secret-key";
    mockV1Config.mockReturnValue({ edinet: { apikey: "v1-config-key" } });

    expect(getEdinetApiKey()).toBe("env-secret-key");
  });

  it("should fallback to functions.config().edinet.apikey if env var is not set", () => {
    mockV1Config.mockReturnValue({ edinet: { apikey: "v1-config-key" } });

    expect(getEdinetApiKey()).toBe("v1-config-key");
  });

  it("should fallback to .runtimeconfig.json if env and functions.config are not available", () => {
    mockV1Config.mockReturnValue({});
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ edinet: { apikey: "file-config-key" } })
    );

    expect(getEdinetApiKey()).toBe("file-config-key");
  });

  it("should return undefined if no key is configured anywhere", () => {
    mockV1Config.mockReturnValue({});
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    expect(getEdinetApiKey()).toBeUndefined();
  });
});
