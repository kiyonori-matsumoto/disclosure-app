import * as admin from "firebase-admin";
import axios from "axios";
import { DEFAULT_USER_AGENT } from "../src/lib/constants";
import { getEdinetApiKey } from "../src/lib/config";
import { ForensicAnalyzer } from "../src/forensic/analyzer";

/**
 * 指定日の TDnet / EDINET 開示ドキュメントを再取得し、
 * 最新のフォレンジックエンジンで再解析して Firestore を更新（データクリーニング）するスクリプト。
 *
 * 使い方:
 *   # プレビュー (Dry-run: 実際に更新せずに対象件数とサンプルを表示)
 *   npm run reanalyze-forensic -- --date 2026-11-09
 *
 *   # 実行 (実際にダウンロードして再解析・Firestore上書き)
 *   npm run reanalyze-forensic -- --date 2026-11-09 --execute
 *
 *   # 最初の5件だけでテスト実行
 *   npm run reanalyze-forensic -- --date 2026-11-09 --limit 5 --execute
 *
 *   # TDnet のみ実行
 *   npm run reanalyze-forensic -- --date 2026-11-09 --tdnet-only --execute
 */

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface ScriptOptions {
  targetDateStr: string;
  execute: boolean;
  limit: number;
  tdnetOnly: boolean;
  edinetOnly: boolean;
  delayMs: number;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  let targetDateStr = "2026-11-09";
  let execute = false;
  let limit = 0;
  let tdnetOnly = false;
  let edinetOnly = false;
  let delayMs = 300;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      targetDateStr = args[i + 1];
      i++;
    } else if (args[i] === "--execute") {
      execute = true;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === "--tdnet-only") {
      tdnetOnly = true;
    } else if (args[i] === "--edinet-only") {
      edinetOnly = true;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10) || 300;
      i++;
    }
  }

  return { targetDateStr, execute, limit, tdnetOnly, edinetOnly, delayMs };
}

const TARGET_EDINET_DOC_TYPES = ["120", "130", "140", "160"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function reanalyze() {
  const options = parseArgs();
  const { targetDateStr, execute, limit, tdnetOnly, edinetOnly, delayMs } = options;

  const startJst = new Date(`${targetDateStr}T00:00:00+09:00`);
  const endJst = new Date(`${targetDateStr}T23:59:59.999+09:00`);

  const startMs = startJst.getTime();
  const endMs = endJst.getTime();
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);

  console.log("================================================================================");
  console.log(`[Forensic Re-analysis / Cleaner]`);
  console.log(`モード       : ${execute ? "【本番実行: EXECUTE】" : "【プレビュー: DRY-RUN】"}`);
  console.log(`対象日 (JST) : ${targetDateStr} (${startJst.toISOString()} 〜 ${endJst.toISOString()})`);
  console.log(`対象範囲     : ${tdnetOnly ? "TDnet のみ" : edinetOnly ? "EDINET のみ" : "TDnet & EDINET"}`);
  if (limit > 0) {
    console.log(`件数制限     : 最大 ${limit} 件`);
  }
  console.log(`リクエスト間隔: ${delayMs} ms`);
  console.log("================================================================================\n");

  interface QueueItem {
    id: string;
    ref: admin.firestore.DocumentReference;
    source: "TDnet" | "EDINET";
    label: string;
    url: string;
    headers: Record<string, string>;
    oldRiskLevel?: string;
  }

  const queue: QueueItem[] = [];

  // 1. TDnet (disclosures) スキャン
  if (!edinetOnly) {
    console.log("Scanning TDnet disclosures...");
    const tdnetSnap = await db
      .collection("disclosures")
      .where("time", ">=", startMs)
      .where("time", "<=", endMs)
      .get();

    tdnetSnap.forEach((doc) => {
      const data = doc.data();
      const xbrlFile = data.xbrl;
      if (xbrlFile && typeof xbrlFile === "string" && xbrlFile.endsWith(".zip")) {
        queue.push({
          id: doc.id,
          ref: doc.ref,
          source: "TDnet",
          label: `[TDnet] ${data.code || ""} ${data.company || ""} - ${data.title || ""}`,
          url: `https://www.release.tdnet.info/inbs/${encodeURIComponent(xbrlFile)}`,
          headers: { "User-Agent": DEFAULT_USER_AGENT },
          oldRiskLevel: data.forensic?.riskLevel,
        });
      }
    });
    console.log(`  TDnet 対象件数: ${queue.length} 件`);
  }

  // 2. EDINET (edinets) スキャン
  if (!tdnetOnly) {
    console.log("Scanning EDINET documents...");
    const edinetCountBefore = queue.length;
    const edinetApiKey = getEdinetApiKey();
    const edinetSnap = await db
      .collection("edinets")
      .where("time", ">=", startSec)
      .where("time", "<=", endSec)
      .get();

    edinetSnap.forEach((doc) => {
      const data = doc.data();
      const docTypeCode = data.docTypeCode;
      if (docTypeCode && TARGET_EDINET_DOC_TYPES.includes(docTypeCode)) {
        queue.push({
          id: doc.id,
          ref: doc.ref,
          source: "EDINET",
          label: `[EDINET] ${data.edinetCode || ""} ${data.filerName || ""} - ${data.docDescription || ""}`,
          url: `https://api.edinet-fsa.go.jp/api/v2/documents/${encodeURIComponent(doc.id)}?type=1`,
          headers: edinetApiKey ? { "Ocp-Apim-Subscription-Key": edinetApiKey } : {},
          oldRiskLevel: data.forensic?.riskLevel,
        });
      }
    });
    console.log(`  EDINET 対象件数: ${queue.length - edinetCountBefore} 件`);
  }

  const totalTargets = limit > 0 ? queue.slice(0, limit) : queue;
  console.log(`\n総再解析対象: ${totalTargets.length} 件\n`);

  if (totalTargets.length === 0) {
    console.log("対象ドキュメントが見つかりませんでした。終了します。");
    return;
  }

  if (!execute) {
    console.log("【DRY-RUN プレビュー】先頭10件の対象:");
    totalTargets.slice(0, 10).forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.oldRiskLevel || "未解析"}] ${item.label}`);
    });
    if (totalTargets.length > 10) {
      console.log(`  ... 他 ${totalTargets.length - 10} 件`);
    }
    console.log("\n実際に対象ドキュメントを再解析してFirestoreを更新するには、--execute オプションを付けて実行してください:");
    console.log(`  npm run reanalyze-forensic -- --date ${targetDateStr} --execute\n`);
    return;
  }

  // 3. 実際の再解析・更新実行
  const analyzer = new ForensicAnalyzer();
  let successCount = 0;
  let failCount = 0;

  const oldStats: Record<string, number> = { critical: 0, warning: 0, normal: 0, none: 0 };
  const newStats: Record<string, number> = { critical: 0, warning: 0, normal: 0 };

  for (let i = 0; i < totalTargets.length; i++) {
    const item = totalTargets[i];
    const prevRisk = item.oldRiskLevel || "none";
    oldStats[prevRisk] = (oldStats[prevRisk] || 0) + 1;

    process.stdout.write(`[${i + 1}/${totalTargets.length}] ${item.source} ${item.id} (${item.label.slice(0, 40)}...) `);

    try {
      const resp = await axios.get(item.url, {
        headers: item.headers,
        responseType: "arraybuffer",
        timeout: 45000,
      });

      const zipBuffer = Buffer.from(resp.data);
      const isTdnet = item.source === "TDnet";
      const result = await analyzer.analyzeZip(zipBuffer, isTdnet);

      // Firestore の更新
      await item.ref.set(
        {
          forensic: result,
        },
        { merge: true }
      );

      newStats[result.riskLevel] = (newStats[result.riskLevel] || 0) + 1;
      successCount++;

      const riskArrow = prevRisk !== result.riskLevel ? `[${prevRisk} -> ${result.riskLevel}]` : `[${result.riskLevel}]`;
      console.log(`OK: ${riskArrow} (tags: ${result.tags.join(",") || "none"})`);
    } catch (err: any) {
      failCount++;
      console.log(`FAILED: ${err.message || err}`);
    }

    if (delayMs > 0 && i < totalTargets.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("\n================================================================================");
  console.log("[Re-analysis Completed]");
  console.log(`成功: ${successCount} 件 / 失敗: ${failCount} 件 / 合計: ${totalTargets.length} 件`);
  console.log("\n【リスクレベルのビフォー・アフター集計】");
  console.log(`  Critical: ${oldStats["critical"] || 0} -> ${newStats["critical"] || 0}`);
  console.log(`  Warning : ${oldStats["warning"] || 0} -> ${newStats["warning"] || 0}`);
  console.log(`  Normal  : ${oldStats["normal"] || 0} -> ${newStats["normal"] || 0}`);
  console.log("================================================================================\n");
}

reanalyze().catch((err) => {
  console.error("Fatal error during re-analysis:", err);
  process.exit(1);
});
