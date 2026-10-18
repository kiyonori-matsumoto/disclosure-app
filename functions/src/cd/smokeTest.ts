import axios from "axios";
import { logger } from "../lib/logger";

export interface SmokeTestTarget {
  name: string;
  url: string;
  expectedStatusMin: number;
  expectedStatusMax: number;
}

export interface SmokeTestResult {
  target: SmokeTestTarget;
  status?: number;
  passed: boolean;
  error?: string;
}

export async function runSmokeTests(
  targets: SmokeTestTarget[],
  httpClient: { get: (url: string, config?: any) => Promise<any> } = axios
): Promise<{ passed: boolean; results: SmokeTestResult[] }> {
  const results: SmokeTestResult[] = [];

  for (const target of targets) {
    try {
      logger.info(`Pinging ${target.name} at ${target.url}...`);
      const response = await httpClient.get(target.url, {
        timeout: 15000,
        validateStatus: () => true, // capture all status codes
      });

      const passed =
        response.status >= target.expectedStatusMin &&
        response.status <= target.expectedStatusMax;

      if (!passed) {
        logger.error(
          `Smoke test failed for ${target.name}: Expected status between ${target.expectedStatusMin}-${target.expectedStatusMax}, but received ${response.status}`
        );
      } else {
        logger.info(
          `Smoke test passed for ${target.name} with HTTP status ${response.status}`
        );
      }

      results.push({
        target,
        status: response.status,
        passed,
      });
    } catch (err: any) {
      logger.error(`Smoke test network error for ${target.name}: ${err.message}`);
      results.push({
        target,
        passed: false,
        error: err.message,
      });
    }
  }

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}

export function getDefaultSmokeTestTargets(
  projectId: string,
  region: string = "asia-northeast1"
): SmokeTestTarget[] {
  return [
    {
      name: "listTopicsV2",
      url: `https://${region}-${projectId}.cloudfunctions.net/listTopicsV2`,
      // Calling without IID_TOKEN returns HTTP 400 Bad Request, confirming runtime is up and running
      expectedStatusMin: 200,
      expectedStatusMax: 499,
    },
    {
      name: "getDownloadUrlEdinetV2",
      url: `https://${region}-${projectId}.cloudfunctions.net/getDownloadUrlEdinetV2`,
      // Calling without docId returns HTTP 400 or 404, confirming runtime is up and running
      expectedStatusMin: 200,
      expectedStatusMax: 499,
    },
  ];
}
