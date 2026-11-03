import * as fs from "fs";
import * as path from "path";

/**
 * Parses a simple .env file content and extracts key-value pairs.
 */
const parseEnvFile = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
};

/**
 * Safely retrieves the EDINET API key.
 * Prioritizes process.env.EDINET_API_KEY (Cloud Secret Manager / environment variables),
 * and falls back to local .env.local during local development/testing.
 */
export const getEdinetApiKey = (): string | undefined => {
  if (process.env.EDINET_API_KEY) {
    return process.env.EDINET_API_KEY;
  }
  try {
    const candidates = [
      path.resolve(__dirname, "../../.env.local"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), "functions/.env.local"),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const envContent = fs.readFileSync(file, "utf8");
        const parsed = parseEnvFile(envContent);
        if (parsed.EDINET_API_KEY) {
          return parsed.EDINET_API_KEY;
        }
      }
    }
  } catch {
    // ignore parse/read errors
  }
  return undefined;
};


