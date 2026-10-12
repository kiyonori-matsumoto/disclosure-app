import * as fs from "fs";
import * as path from "path";

/**
 * Safely retrieves the EDINET API key without calling deprecated functions.config().
 * Prioritizes process.env.EDINET_API_KEY (Cloud Secret Manager / env vars),
 * falling back to local .runtimeconfig.json during local development/testing.
 */
export const getEdinetApiKey = (): string | undefined => {
  if (process.env.EDINET_API_KEY) {
    return process.env.EDINET_API_KEY;
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
