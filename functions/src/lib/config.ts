import * as fs from "fs";
import * as path from "path";

/**
 * Safely retrieves the EDINET API key.
 * Prioritizes process.env.EDINET_API_KEY (Cloud Secret Manager / env vars),
 * then falls back to functions.config().edinet.apikey (for legacy v1 compatibility),
 * and finally to local .runtimeconfig.json during local development/testing.
 */
export const getEdinetApiKey = (): string | undefined => {
  if (process.env.EDINET_API_KEY) {
    return process.env.EDINET_API_KEY;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const functions = require("firebase-functions/v1");
    const v1Config = functions?.config?.();
    if (v1Config?.edinet?.apikey) {
      return v1Config.edinet.apikey;
    }
  } catch {
    // ignore if functions.config() throws or is unavailable
  }
  try {
    const candidates = [
      path.resolve(__dirname, "../../.runtimeconfig.json"),
      path.resolve(process.cwd(), ".runtimeconfig.json"),
      path.resolve(process.cwd(), "functions/.runtimeconfig.json"),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        if (config?.edinet?.apikey) {
          return config.edinet.apikey;
        }
      }
    }
  } catch {
    // ignore parse/read errors
  }
  return undefined;
};

