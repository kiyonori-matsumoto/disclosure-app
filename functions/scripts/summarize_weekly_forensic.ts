import * as admin from "firebase-admin";

/**
 * 直近1週間のフォレンジック解析結果を集計・分析するスクリプト。
 * 
 * 【完全読み取り専用 (Read-Only) 保証】
 * - Firestore に対する set / update / delete / add / batch 等の書き込み操作は一切含まれません。
 * - db.collection(...).where(...).get() による取得（SELECT）のみを行います。
 */

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "disclosure-app",
  });
}

const db = admin.firestore();

interface ItemSummary {
  id: string;
  source: "TDnet" | "EDINET";
  code: string;
  name: string;
  title: string;
  dateStr: string;
  timeMs: number;
  analyzedAtSec?: number;
  riskLevel: string;
  tags: string[];
  causes: string[];
  metrics?: any;
  details?: any;
}

async function runWeeklySummary() {
  // 直近1週間の範囲 (JST): 2026-11-06 00:00:00 〜 2026-11-12 23:59:59.999
  const startDateStr = "2026-11-06";
  const endDateStr = "2026-11-12";

  const startJst = new Date(`${startDateStr}T00:00:00+09:00`);
  const endJst = new Date(`${endDateStr}T23:59:59.999+09:00`);

  const startMs = startJst.getTime();
  const endMs = endJst.getTime();
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);

  console.log("================================================================================");
  console.log(`[Weekly Forensic Summary] 対象期間 (JST): ${startDateStr} 〜 ${endDateStr}`);
  console.log(`[Weekly Forensic Summary] モード: 完全読み取り専用 (Read-Only)`);
  console.log("================================================================================\n");

  const items: ItemSummary[] = [];

  // 1. TDnet (disclosures) の取得
  console.log("Fetching TDnet disclosures for the week...");
  const tdnetSnapshot = await db
    .collection("disclosures")
    .where("time", ">=", startMs)
    .where("time", "<=", endMs)
    .get();
  console.log(`  TDnet documents fetched: ${tdnetSnapshot.size}`);

  tdnetSnapshot.forEach((doc) => {
    const data = doc.data();
    const forensic = data.forensic;
    const timeMs = typeof data.time === "number" ? data.time : 0;
    const dateStr = timeMs ? new Date(timeMs + 9 * 3600 * 1000).toISOString().slice(0, 10) : "";

    items.push({
      id: doc.id,
      source: "TDnet",
      code: data.code || "",
      name: data.company || "",
      title: data.title || "",
      dateStr,
      timeMs,
      analyzedAtSec: forensic?.analyzedAt,
      riskLevel: forensic?.riskLevel || (forensic ? "normal" : "unprocessed"),
      tags: forensic?.tags || [],
      causes: forensic?.causes || [],
      metrics: forensic?.metrics,
      details: forensic?.details,
    });
  });

  // 2. EDINET (edinets) の取得
  console.log("Fetching EDINET documents for the week...");
  const edinetSnapshot = await db
    .collection("edinets")
    .where("time", ">=", startSec)
    .where("time", "<=", endSec)
    .get();
  console.log(`  EDINET documents fetched: ${edinetSnapshot.size}\n`);

  edinetSnapshot.forEach((doc) => {
    const data = doc.data();
    const forensic = data.forensic;
    const timeMs = typeof data.time === "number" ? data.time * 1000 : 0;
    const dateStr = timeMs ? new Date(timeMs + 9 * 3600 * 1000).toISOString().slice(0, 10) : "";

    items.push({
      id: doc.id,
      source: "EDINET",
      code: data.secCode || data.edinetCode || "",
      name: data.filerName || "",
      title: data.docDescription || "",
      dateStr,
      timeMs,
      analyzedAtSec: forensic?.analyzedAt,
      riskLevel: forensic?.riskLevel || (forensic ? "normal" : "unprocessed"),
      tags: forensic?.tags || [],
      causes: forensic?.causes || [],
      metrics: forensic?.metrics,
      details: forensic?.details,
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
  const dailyBreakdown: Record<string, { total: number; processed: number; critical: number; warning: number; normal: number }> = {};

  const criticalItems: ItemSummary[] = [];
  const warningItems: ItemSummary[] = [];

  for (const item of processedItems) {
    riskCounts[item.riskLevel] = (riskCounts[item.riskLevel] || 0) + 1;

    // 日別
    if (!dailyBreakdown[item.dateStr]) {
      dailyBreakdown[item.dateStr] = { total: 0, processed: 0, critical: 0, warning: 0, normal: 0 };
    }
    dailyBreakdown[item.dateStr].processed++;
    if (item.riskLevel === "critical") dailyBreakdown[item.dateStr].critical++;
    if (item.riskLevel === "warning") dailyBreakdown[item.dateStr].warning++;
    if (item.riskLevel === "normal") dailyBreakdown[item.dateStr].normal++;

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

  for (const item of items) {
    if (!dailyBreakdown[item.dateStr]) {
      dailyBreakdown[item.dateStr] = { total: 0, processed: 0, critical: 0, warning: 0, normal: 0 };
    }
    dailyBreakdown[item.dateStr].total++;
  }

  // 表示
  console.log("================================================================================");
  console.log("【直近1週間 (2026-11-06 〜 2026-11-12) 全体集計サマリー】");
  console.log("================================================================================");
  console.log(`総開示件数: ${totalCount} 件 (TDnet: ${tdnetSnapshot.size}, EDINET: ${edinetSnapshot.size})`);
  console.log(`解析済み件数: ${processedItems.length} 件 / 未解析（対象外含む）: ${unprocessedCount} 件`);
  const coveragePct = totalCount > 0 ? ((processedItems.length / totalCount) * 100).toFixed(1) : "0.0";
  console.log(`解析カバー率: ${coveragePct}%\n`);

  console.log("--- リスクレベル内訳 ---");
  const critPct = processedItems.length > 0 ? ((riskCounts.critical / processedItems.length) * 100).toFixed(1) : "0.0";
  const warnPct = processedItems.length > 0 ? ((riskCounts.warning / processedItems.length) * 100).toFixed(1) : "0.0";
  const normPct = processedItems.length > 0 ? ((riskCounts.normal / processedItems.length) * 100).toFixed(1) : "0.0";
  console.log(`  🚨 CRITICAL : ${riskCounts.critical.toString().padStart(5)} 件 (${critPct}%)`);
  console.log(`  ⚠️  WARNING  : ${riskCounts.warning.toString().padStart(5)} 件 (${warnPct}%)`);
  console.log(`  ✅ NORMAL   : ${riskCounts.normal.toString().padStart(5)} 件 (${normPct}%)\n`);

  console.log("--- 日別推移 ---");
  console.log(" 日付       | 総開示 | 解析済 | Critical (%) | Warning (%) | Normal (%)");
  console.log("------------+--------+--------+--------------+-------------+------------");
  const sortedDates = Object.keys(dailyBreakdown).sort();
  for (const d of sortedDates) {
    const row = dailyBreakdown[d];
    const cPct = row.processed > 0 ? ((row.critical / row.processed) * 100).toFixed(1) : "0.0";
    const wPct = row.processed > 0 ? ((row.warning / row.processed) * 100).toFixed(1) : "0.0";
    const nPct = row.processed > 0 ? ((row.normal / row.processed) * 100).toFixed(1) : "0.0";
    console.log(
      ` ${d} | ${row.total.toString().padStart(6)} | ${row.processed.toString().padStart(6)} | ` +
      `${row.critical.toString().padStart(4)} (${cPct.padStart(4)}%) | ` +
      `${row.warning.toString().padStart(3)} (${wPct.padStart(4)}%) | ` +
      `${row.normal.toString().padStart(4)} (${nPct.padStart(4)}%)`
    );
  }
  console.log("");

  console.log("--- 検出されたレッドフラグ・タグ内訳（降順） ---");
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTags.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [tag, count] of sortedTags) {
      const pct = ((count / processedItems.length) * 100).toFixed(1);
      console.log(`  - ${tag.padEnd(30)}: ${count.toString().padStart(5)} 件 (${pct}%)`);
    }
  }
  console.log("");

  console.log("--- 検出された要因タグ（Cause Tags） ---");
  const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);
  if (sortedCauses.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [cause, count] of sortedCauses) {
      console.log(`  - ${cause.padEnd(25)}: ${count.toString().padStart(5)} 件`);
    }
  }

  // 精度チェック用：潜在的エッジケース・異常値の分析
  console.log("\n================================================================================");
  console.log("【精度チェック分析：特異パターン・要確認項目の抽出】");
  console.log("================================================================================");

  // 1. DSI (棚卸資産回転期間指数) が極端に高い案件 (DSI > 3.0)
  const extremeDsi = criticalItems.filter((i) => (i.metrics?.calculations?.dsiIndex ?? 0) > 3.0);
  console.log(`\n▶ [要確認 1] DSI (棚卸資産回転指数) が極端に高い (> 3.0) 開示: ${extremeDsi.length} 件`);
  extremeDsi.slice(0, 5).forEach((item, idx) => {
    console.log(`   (${idx + 1}) [${item.source}] ${item.code} ${item.name} (${item.title.slice(0, 35)}...)`);
    console.log(`       DSI: ${item.metrics?.calculations?.dsiIndex} | 売上: ${(item.metrics?.revenue / 1000).toFixed(0)}百万円 | 棚卸: ${(item.metrics?.current?.inventories / 1000 || 0).toFixed(0)}百万円`);
  });

  // 2. AQI (資産の質指数) が極端に高い案件 (AQI > 2.0)
  const extremeAqi = criticalItems.filter((i) => (i.metrics?.calculations?.aqi ?? 0) > 2.0);
  console.log(`\n▶ [要確認 2] AQI (資産の質指数) が極端に高い (> 2.0) 開示: ${extremeAqi.length} 件`);
  extremeAqi.slice(0, 5).forEach((item, idx) => {
    console.log(`   (${idx + 1}) [${item.source}] ${item.code} ${item.name} (${item.title.slice(0, 35)}...)`);
    console.log(`       AQI: ${item.metrics?.calculations?.aqi}`);
  });

  // 3. アクルーアル比率 (Accruals Ratio) が極端に高い (> 0.25) 案件
  const extremeAccruals = criticalItems.filter((i) => (i.metrics?.calculations?.accrualsRatio ?? 0) > 0.25);
  console.log(`\n▶ [要確認 3] アクルーアル比率が極端に高い (> 25%) 開示: ${extremeAccruals.length} 件`);
  extremeAccruals.slice(0, 5).forEach((item, idx) => {
    console.log(`   (${idx + 1}) [${item.source}] ${item.code} ${item.name} (${item.title.slice(0, 35)}...)`);
    console.log(`       Accruals: ${(item.metrics?.calculations?.accrualsRatio * 100).toFixed(1)}% | 営業CF: ${(item.metrics?.operatingCashFlow / 1000).toFixed(0)}百万円 | 純利益: ${(item.metrics?.netIncome / 1000).toFixed(0)}百万円`);
  });

  // 4. 定性判定 (Jev) の blameAttribution / unfoundedOptimism
  const blameItems = criticalItems.concat(warningItems).filter((i) => i.details?.blameAttribution || i.details?.unfoundedOptimism);
  console.log(`\n▶ [要確認 4] 定性判定で他責または過度な楽観が検知された開示: ${blameItems.length} 件`);
  blameItems.slice(0, 5).forEach((item, idx) => {
    console.log(`   (${idx + 1}) [${item.source}] ${item.code} ${item.name}`);
    console.log(`       他責傾向: ${item.details?.blameAttribution || "なし"} | 過度な楽観: ${item.details?.unfoundedOptimism ? "あり" : "なし"}`);
  });

  // 5. 金融機関・証券会社などの混入チェック (銀行・証券・保険業等)
  const financeKeywords = ["銀行", "証券", "保険", "フィナンシャル", "信託", "リース"];
  const financeItems = criticalItems.filter((i) => financeKeywords.some((k) => i.name.includes(k)));
  console.log(`\n▶ [要確認 5] 金融・証券・リース等でCRITICAL判定された開示: ${financeItems.length} 件`);
  financeItems.slice(0, 5).forEach((item, idx) => {
    console.log(`   (${idx + 1}) [${item.source}] ${item.code} ${item.name} (${item.title.slice(0, 35)}...)`);
    console.log(`       タグ: ${item.tags.join(", ")}`);
  });

  console.log("\n================================================================================");
}

runWeeklySummary().catch((err) => {
  console.error("集計実行時エラー:", err);
  process.exit(1);
});
