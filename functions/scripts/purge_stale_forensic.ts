import * as admin from "firebase-admin";

/**
 * 過去N日分の disclosures / edinets コレクションから
 * 旧計算ロジックによる forensic 解析結果（forensicフィールド）を削除（リセット）するスクリプト。
 *
 * 使い方:
 *   # プレビュー (Dry-run: 削除せずに対象を表示)
 *   npx ts-node scripts/purge_stale_forensic.ts --days 7
 *
 *   # 実行 (実際に削除)
 *   npx ts-node scripts/purge_stale_forensic.ts --days 7 --execute
 */

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface PurgeOptions {
  days: number;
  execute: boolean;
}

function parseArgs(): PurgeOptions {
  const args = process.argv.slice(2);
  let days = 7;
  let execute = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        days = parsed;
      }
      i++;
    } else if (args[i] === "--execute") {
      execute = true;
    }
  }

  return { days, execute };
}

async function purgeStaleForensic() {
  const { days, execute } = parseArgs();
  const now = Date.now();
  const cutoffDate = new Date(now - days * 24 * 60 * 60 * 1000);
  const cutoffMs = cutoffDate.getTime();
  const cutoffSec = Math.floor(cutoffMs / 1000);

  console.log("==================================================");
  console.log(`[Forensic Purge] Mode: ${execute ? "EXECUTE (REAL RUN)" : "DRY-RUN (PREVIEW)"}`);
  console.log(`[Forensic Purge] Target period: Last ${days} days (>= ${cutoffDate.toISOString()})`);
  console.log("==================================================\n");

  // 1. TDnet (disclosures) のスキャン
  console.log("Scanning 'disclosures' (TDnet)...");
  const disclosuresSnapshot = await db
    .collection("disclosures")
    .where("time", ">=", cutoffMs)
    .get();

  const targetDisclosures: { ref: admin.firestore.DocumentReference; id: string; label: string }[] = [];
  disclosuresSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data && data.forensic) {
      targetDisclosures.push({
        ref: doc.ref,
        id: doc.id,
        label: `[TDnet] ${data.code || ""} ${data.company || ""} - ${data.title || ""}`,
      });
    }
  });

  console.log(`  Found ${targetDisclosures.length} TDnet documents with stale forensic data.`);
  targetDisclosures.slice(0, 10).forEach((t) => console.log(`    - ${t.id}: ${t.label}`));
  if (targetDisclosures.length > 10) {
    console.log(`    ... and ${targetDisclosures.length - 10} more.`);
  }

  // 2. EDINET (edinets) のスキャン
  console.log("\nScanning 'edinets' (EDINET)...");
  const edinetsSnapshot = await db
    .collection("edinets")
    .where("time", ">=", cutoffSec)
    .get();

  const targetEdinets: { ref: admin.firestore.DocumentReference; id: string; label: string }[] = [];
  edinetsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data && data.forensic) {
      targetEdinets.push({
        ref: doc.ref,
        id: doc.id,
        label: `[EDINET] ${data.edinetCode || ""} ${data.filerName || ""} - ${data.docDescription || ""}`,
      });
    }
  });

  console.log(`  Found ${targetEdinets.length} EDINET documents with stale forensic data.`);
  targetEdinets.slice(0, 10).forEach((t) => console.log(`    - ${t.id}: ${t.label}`));
  if (targetEdinets.length > 10) {
    console.log(`    ... and ${targetEdinets.length - 10} more.`);
  }

  const allTargets = [...targetDisclosures, ...targetEdinets];
  console.log(`\nTotal targets: ${allTargets.length} documents.`);

  if (allTargets.length === 0) {
    console.log("\nNo documents found to purge. Exiting.");
    return;
  }

  if (!execute) {
    console.log("\n[DRY-RUN] No changes were made to Firestore.");
    console.log("To permanently delete the 'forensic' field and enable recalculation, run:");
    console.log(`  npx ts-node scripts/purge_stale_forensic.ts --days ${days} --execute\n`);
    return;
  }

  // 3. 実際の削除バッチ実行 (500件単位)
  console.log("\nExecuting batch deletion of 'forensic' fields...");
  const BATCH_SIZE = 450;
  let updatedCount = 0;

  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const chunk = allTargets.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      batch.update(item.ref, {
        forensic: admin.firestore.FieldValue.delete(),
      });
    }

    await batch.commit();
    updatedCount += chunk.length;
    console.log(`  Committed batch: ${updatedCount} / ${allTargets.length}`);
  }

  console.log(`\n[SUCCESS] Successfully purged 'forensic' field from ${updatedCount} documents.`);
  console.log("Documents are now ready to be re-analyzed with the new forensic engine.\n");
}

purgeStaleForensic().catch((err) => {
  console.error("Purge failed with error:", err);
  process.exit(1);
});
