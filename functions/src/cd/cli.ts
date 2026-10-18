import { runRecordRevisions } from "./recordRevisions";
import { rollbackServices } from "./rollbackRevisions";
import { runSmokeTests, getDefaultSmokeTestTargets } from "./smokeTest";
import { logger } from "../lib/logger";

const action = process.argv[2];
const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "disclosure-app";
const region = process.env.GCP_REGION || "asia-northeast1";
const backupFile = process.env.REVISIONS_BACKUP_FILE || "./revisions-backup.json";

export async function main(
  actionArg?: string,
  projArg?: string,
  regionArg?: string,
  backupArg?: string
): Promise<number> {
  const act = actionArg || action;
  const proj = projArg || projectId;
  const reg = regionArg || region;
  const backup = backupArg || backupFile;

  if (act === "record") {
    logger.info(`Recording active revisions for project ${proj} in ${reg}...`);
    const result = runRecordRevisions(backup, proj, reg);
    logger.info(`Recorded ${Object.keys(result.services).length} revisions.`);
    return 0;
  } else if (act === "rollback") {
    logger.info(`Initiating automated rollback from ${backup}...`);
    const res = rollbackServices(backup);
    if (res.failed > 0) {
      logger.error(`Rollback had failures: ${res.failed} / ${res.total}`);
      return 1;
    }
    logger.info(`Automated rollback completed successfully (${res.succeeded}/${res.total}).`);
    return 0;
  } else if (act === "smoke") {
    logger.info(`Running smoke tests for project ${proj} in ${reg}...`);
    const targets = getDefaultSmokeTestTargets(proj, reg);
    const { passed, results } = await runSmokeTests(targets);
    if (!passed) {
      logger.error("Smoke tests failed!", { results });
      return 1;
    }
    logger.info("All smoke tests passed successfully!");
    return 0;
  } else {
    logger.error(`Unknown action: ${act}. Use record, rollback, or smoke.`);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  }).catch((err) => {
    logger.error("CLI Execution failed:", err);
    process.exit(1);
  });
}
