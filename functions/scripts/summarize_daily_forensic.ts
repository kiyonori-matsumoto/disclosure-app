import * as admin from "firebase-admin";

/**
 * 当日（または指定日）のフォレンジック解析結果を集計・出力するスクリプト。
 *
 * 使い方:
 *   # 今日のフォレンジック結果を集計（JST基準）
 *   npx ts-node scripts/summarize_daily_forensic.ts
 *
 *   # 日付を指定して集計 (YYYY-MM-DD)
 *   npx ts-node scripts/summarize_daily_forensic.ts --date 2026-11-09
 *
 *   # 詳細（Criticalドキュメントの全タグやWarningメッセージ等）を表示
 *   npx ts-node scripts/summarize_daily_forensic.ts --verbose
 *
 *   # 開示日時(time)ではなくフォレンジック解析実行日時(forensic.analyzedAt)で集計
 *   npx ts-node scripts/summarize_daily_forensic.ts --by-analyzed-at
 */

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface ScriptOptions {
  targetDateStr: string;
  verbose: boolean;
  byAnalyzedAt: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  let targetDateStr = "";
  let verbose = false;
  let byAnalyzedAt = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) {
      targetDateStr = args[i + 1];
      i++;
    } else if (args[i] === "--verbose") {
      verbose = true;
    } else if (args[i] === "--by-analyzed-at") {
      byAnalyzedAt = true;
    }
  }

  if (!targetDateStr) {
    // デフォルト: 現在のJST日付 (UTC+9)
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    targetDateStr = jstNow.toISOString().slice(0, 10);
  }

  return { targetDateStr, verbose, byAnalyzedAt };
}

interface ItemSummary {
  id: string;
  source: "TDnet" | "EDINET";
  code: string;
  name: string;
  title: string;
  timeMs: number;
  analyzedAtSec?: number;
  riskLevel: string;
  tags: string[];
  causes: string[];
  warnings?: string[];
  metrics?: any;
}

async function summarize() {
  const { targetDateStr, verbose, byAnalyzedAt } = parseArgs();

  // JSTの 00:00:00 〜 23:59:59.999 の範囲を計算
  const startJst = new Date(`${targetDateStr}T00:00:00+09:00`);
  const endJst = new Date(`${targetDateStr}T23:59:59.999+09:00`);

  const startMs = startJst.getTime();
  const endMs = endJst.getTime();
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);

  console.log("================================================================================");
  console.log(`[Forensic Summary] 対象日 (JST): ${targetDateStr}`);
  console.log(`[Forensic Summary] 範囲: ${startJst.toISOString()} 〜 ${endJst.toISOString()}`);
  console.log(`[Forensic Summary] 集計軸: ${byAnalyzedAt ? "解析実行日時 (analyzedAt)" : "開示日時 (time)"}`);
  console.log("================================================================================\n");

  const items: ItemSummary[] = [];

  // 1. TDnet (disclosures) の集計
  console.log("Fetching TDnet disclosures...");
  let disclosuresQuery: admin.firestore.Query = db.collection("disclosures");

  if (!byAnalyzedAt) {
    disclosuresQuery = disclosuresQuery
      .where("time", ">=", startMs)
      .where("time", "<=", endMs);
  } else {
    disclosuresQuery = disclosuresQuery
      .where("forensic.analyzedAt", ">=", startSec)
      .where("forensic.analyzedAt", "<=", endSec);
  }

  const tdnetSnapshot = await disclosuresQuery.get();
  console.log(`  TDnet documents fetched: ${tdnetSnapshot.size}`);

  tdnetSnapshot.forEach((doc) => {
    const data = doc.data();
    const forensic = data.forensic;
    items.push({
      id: doc.id,
      source: "TDnet",
      code: data.code || "",
      name: data.company || "",
      title: data.title || "",
      timeMs: typeof data.time === "number" ? data.time : 0,
      analyzedAtSec: forensic?.analyzedAt,
      riskLevel: forensic?.riskLevel || (forensic ? "normal" : "unprocessed"),
      tags: forensic?.tags || [],
      causes: forensic?.causes || [],
      metrics: forensic?.metrics,
    });
  });

  // 2. EDINET (edinets) の集計
  console.log("Fetching EDINET documents...");
  let edinetQuery: admin.firestore.Query = db.collection("edinets");

  if (!byAnalyzedAt) {
    edinetQuery = edinetQuery
      .where("time", ">=", startSec)
      .where("time", "<=", endSec);
  } else {
    edinetQuery = edinetQuery
      .where("forensic.analyzedAt", ">=", startSec)
      .where("forensic.analyzedAt", "<=", endSec);
  }

  const edinetSnapshot = await edinetQuery.get();
  console.log(`  EDINET documents fetched: ${edinetSnapshot.size}\n`);

  edinetSnapshot.forEach((doc) => {
    const data = doc.data();
    const forensic = data.forensic;
    items.push({
      id: doc.id,
      source: "EDINET",
      code: data.secCode || data.edinetCode || "",
      name: data.filerName || "",
      title: data.docDescription || "",
      timeMs: typeof data.time === "number" ? data.time * 1000 : 0,
      analyzedAtSec: forensic?.analyzedAt,
      riskLevel: forensic?.riskLevel || (forensic ? "normal" : "unprocessed"),
      tags: forensic?.tags || [],
      causes: forensic?.causes || [],
      metrics: forensic?.metrics,
    });
  });

  // 集計処理
  const totalCount = items.length;
  const processedItems = items.filter((i) => i.riskLevel !== "unprocessed");
  const unprocessedCount = totalCount - processedItems.length;

  const riskCounts: Record<string, number> = {
    critical: 0,
    warning: 0,
    normal: 0,
  };

  const tagCounts: Record<string, number> = {};
  const causeCounts: Record<string, number> = {};

  const criticalItems: ItemSummary[] = [];
  const warningItems: ItemSummary[] = [];

  for (const item of processedItems) {
    riskCounts[item.riskLevel] = (riskCounts[item.riskLevel] || 0) + 1;

    for (const tag of item.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    for (const cause of item.causes) {
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;
    }

    if (item.riskLevel === "critical") {
      criticalItems.push(item);
    } else if (item.riskLevel === "warning") {
      warningItems.push(item);
    }
  }

  // 表示
  console.log("================================================================================");
  console.log("【集計サマリー】");
  console.log("================================================================================");
  console.log(`総開示件数: ${totalCount} 件 (TDnet: ${tdnetSnapshot.size}, EDINET: ${edinetSnapshot.size})`);
  console.log(`解析済み件数: ${processedItems.length} 件 / 未解析（対象外含む）: ${unprocessedCount} 件`);
  console.log("");
  console.log("--- リスクレベル内訳 ---");
  const critPct = processedItems.length > 0 ? ((riskCounts.critical / processedItems.length) * 100).toFixed(1) : "0.0";
  const warnPct = processedItems.length > 0 ? ((riskCounts.warning / processedItems.length) * 100).toFixed(1) : "0.0";
  const normPct = processedItems.length > 0 ? ((riskCounts.normal / processedItems.length) * 100).toFixed(1) : "0.0";
  console.log(`  🚨 CRITICAL : ${riskCounts.critical.toString().padStart(4)} 件 (${critPct}%)`);
  console.log(`  ⚠️  WARNING  : ${riskCounts.warning.toString().padStart(4)} 件 (${warnPct}%)`);
  console.log(`  ✅ NORMAL   : ${riskCounts.normal.toString().padStart(4)} 件 (${normPct}%)`);
  console.log("");

  console.log("--- 検出されたレッドフラグ・タグ内訳（降順） ---");
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTags.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [tag, count] of sortedTags) {
      const pct = ((count / processedItems.length) * 100).toFixed(1);
      console.log(`  - ${tag.padEnd(30)}: ${count.toString().padStart(4)} 件 (${pct}%)`);
    }
  }
  console.log("");

  console.log("--- 検出された要因タグ（Cause Tags） ---");
  const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);
  if (sortedCauses.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [cause, count] of sortedCauses) {
      console.log(`  - ${cause.padEnd(25)}: ${count.toString().padStart(4)} 件`);
    }
  }
  console.log("\n================================================================================");
  console.log(`【CRITICAL判定された開示一覧 (${criticalItems.length}件)】`);
  console.log("================================================================================");

  if (criticalItems.length === 0) {
    console.log("  CRITICAL判定の開示はありません。");
  } else {
    criticalItems.forEach((item, idx) => {
      console.log(`\n[${idx + 1}] [${item.source}] ${item.code} ${item.name}`);
      console.log(`    タイトル: ${item.title}`);
      console.log(`    検知タグ: ${item.tags.join(", ") || "(タグなし)"}`);
      if (item.metrics?.calculations) {
        const c = item.metrics.calculations;
        const details: string[] = [];
        if (c.accrualsRatio !== undefined) details.push(`Accruals比率: ${(c.accrualsRatio * 100).toFixed(1)}%`);
        if (c.dsri !== undefined) details.push(`DSRI: ${c.dsri}`);
        if (c.dsiIndex !== undefined) details.push(`DSI: ${c.dsiIndex}`);
        if (c.aqi !== undefined) details.push(`AQI: ${c.aqi}`);
        if (c.cashCoverage !== undefined) details.push(`現預金/流動負債: ${(c.cashCoverage * 100).toFixed(1)}%`);
        if (c.equityRatio !== undefined) details.push(`自己資本比率: ${(c.equityRatio * 100).toFixed(1)}%`);
        if (details.length > 0) {
          console.log(`    指標計算値: ${details.join(" | ")}`);
        }
      }
      if (item.metrics) {
        const m = item.metrics;
        const rev = m.revenue !== undefined ? `${(m.revenue / 1000).toFixed(0)}百万円` : "-";
        const op = m.operatingIncome !== undefined ? `${(m.operatingIncome / 1000).toFixed(0)}百万円` : "-";
        const ocf = m.operatingCashFlow !== undefined ? `${(m.operatingCashFlow / 1000).toFixed(0)}百万円` : "-";
        const payout = m.payoutRatio !== undefined ? `${m.payoutRatio.toFixed(1)}%` : "-";
        console.log(`    主要数値: 売上=${rev}, 営利=${op}, 営業CF=${ocf}, 配当性向=${payout}`);
      }
      if (verbose) {
        console.log(`    Doc ID: ${item.id}`);
      }
    });
  }

  console.log("\n================================================================================");
}

summarize().catch((err) => {
  console.error("集計中にエラーが発生しました:", err);
  process.exit(1);
});
