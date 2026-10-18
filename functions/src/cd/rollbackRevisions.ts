import * as fs from "fs";
import { execSync } from "child_process";
import { logger } from "../lib/logger";
import { RevisionsBackup } from "./recordRevisions";

export interface RollbackResult {
  service: string;
  targetRevision: string;
  success: boolean;
  error?: string;
}

export function rollbackServices(
  backupFilePath: string,
  execFn: (cmd: string) => string = (cmd) => execSync(cmd, { encoding: "utf-8" })
): { total: number; succeeded: number; failed: number; results: RollbackResult[] } {
  if (!fs.existsSync(backupFilePath)) {
    logger.error(`Backup file not found at ${backupFilePath}. Cannot perform automated rollback.`);
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const content = fs.readFileSync(backupFilePath, "utf-8");
  let backup: RevisionsBackup;
  try {
    backup = JSON.parse(content);
  } catch (err: any) {
    logger.error(`Failed to parse backup file at ${backupFilePath}: ${err.message}`);
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  const { projectId, region, services } = backup;
  const results: RollbackResult[] = [];
  const serviceEntries = Object.entries(services || {});

  logger.info(`Starting rollback for ${serviceEntries.length} services in ${region}...`);

  for (const [service, revision] of serviceEntries) {
    const cmd = `gcloud run services update-traffic ${service} --to-revisions=${revision}=100 --project=${projectId} --region=${region}`;
    try {
      logger.info(`Rolling back ${service} to revision ${revision}...`);
      execFn(cmd);
      results.push({ service, targetRevision: revision, success: true });
    } catch (err: any) {
      logger.error(`Failed to rollback service ${service} to ${revision}: ${err.message}`);
      results.push({ service, targetRevision: revision, success: false, error: err.message });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  };
}
