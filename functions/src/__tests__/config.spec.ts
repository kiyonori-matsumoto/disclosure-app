import "jest";

// Mock fs before importing config
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import * as fs from "fs";
import { getEdinetApiKey } from "../lib/config";

describe("getEdinetApiKey", () => {
  const originalEnv = process.env.EDINET_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EDINET_API_KEY;
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

    expect(getEdinetApiKey()).toBe("env-secret-key");
  });

  it("should fallback to .env.local if process.env.EDINET_API_KEY is not set", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      "OTHER_VAR=foo\n# Comment line\nEDINET_API_KEY=local-env-key\nANOTHER_VAR=bar"
    );

    expect(getEdinetApiKey()).toBe("local-env-key");
  });

  it("should handle quoted values in .env.local", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      'EDINET_API_KEY="quoted-env-key"'
    );

    expect(getEdinetApiKey()).toBe("quoted-env-key");
  });

  it("should return undefined if no key is configured anywhere", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    expect(getEdinetApiKey()).toBeUndefined();
  });
});
