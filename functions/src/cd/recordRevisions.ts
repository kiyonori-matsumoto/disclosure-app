import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { logger } from "../lib/logger";

export interface RevisionsBackup {
  projectId: string;
  region: string;
  timestamp: string;
  services: Record<string, string>; // serviceName -> revisionName
}

export function fetchCloudRunRevisions(
  projectId: string,
  region: string = "asia-northeast1",
  execFn: (cmd: string) => string = (cmd) => execSync(cmd, { encoding: "utf-8" })
): Record<string, string> {
  const cmd = `gcloud run services list --project=${projectId} --region=${region} --format=json`;
  logger.info(`Fetching Cloud Run services for project ${projectId} in ${region}...`);

  let rawJson: string;
  try {
    rawJson = execFn(cmd);
  } catch (err: any) {
    logger.warn(`Failed to list Cloud Run services via gcloud: ${err.message}`);
    return {};
  }

  if (!rawJson || !rawJson.trim()) {
    return {};
  }

  let services: any;
  try {
    services = JSON.parse(rawJson);
  } catch (err: any) {
    logger.warn(`Failed to parse gcloud output as JSON: ${err.message}`);
    return {};
  }

  const result: Record<string, string> = {};

  if (!Array.isArray(services)) {
    return result;
  }

  for (const svc of services) {
    const name = svc.metadata?.name;
    if (!name) continue;

    // Check traffic allocation first
    const traffic = svc.status?.traffic;
    let targetRevision: string | undefined;
    if (Array.isArray(traffic)) {
      const activeTraffic = traffic.find(
        (t: any) => t.percent && t.percent > 0 && t.revisionName
      );
      if (activeTraffic) {
        targetRevision = activeTraffic.revisionName;
      }
    }

    // Fallback to latestReadyRevisionName
    if (!targetRevision) {
      targetRevision = svc.status?.latestReadyRevisionName;
    }

    if (targetRevision) {
      result[name] = targetRevision;
    }
  }

  return result;
}

export function saveRevisionsBackup(
  filePath: string,
  projectId: string,
  region: string,
  revisions: Record<string, string>
): RevisionsBackup {
  const backup: RevisionsBackup = {
    projectId,
    region,
    timestamp: new Date().toISOString(),
    services: revisions,
  };

  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), "utf-8");
  logger.info(`Saved ${Object.keys(revisions).length} service revisions to ${filePath}`);
  return backup;
}

export function runRecordRevisions(
  outputFilePath: string,
  projectId: string,
  region: string = "asia-northeast1",
  execFn?: (cmd: string) => string
): RevisionsBackup {
  const revisions = fetchCloudRunRevisions(projectId, region, execFn);
  return saveRevisionsBackup(outputFilePath, projectId, region, revisions);
}
