import * as functions from "firebase-functions/v1";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

// Cloud Functions v2 のデフォルトリージョンを日本（東京: asia-northeast1）に設定
setGlobalOptions({
  region: "asia-northeast1",
});

import { checkNewDisclosure as checkNewDisclosureHandler } from "./checkNewDisclosure";
import sendTopicHandler from "./sendTopic";
import createSettlementDictHandler from "./createSettlementDict";
import sendSettlementToTopicHandler from "./sendSettlementToTopic";
import checkNewEdinetHandler from "./checkNewEdinet";
import sendEdinetToTopicHandler from "./sendEdinetToTopic";
import getDownloadUrlEdinetHandler from "./downloadNewEdinet";
import createCompanyDictHandler from "./createCompanyDict";
import { listTopics as listTopicsHandler } from "./listTopics";
import handleContentViewEventHandler from "./handleContentViewEvent";
import saveDocumentHandler from "./saveDocument";

// --- Cloud Functions v2: Scheduled Functions (東京リージョン asia-northeast1) ---

// 5分毎のTDnet開示情報チェック
export const checkNewDisclosure2 = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: 120,
  },
  async () => {
    await checkNewDisclosureHandler();
  }
);

// 5分毎のEDINET開示情報チェック
export const checkNewEdinet = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: 120,
    secrets: ["EDINET_API_KEY"],
  },
  async () => {
    await checkNewEdinetHandler();
  }
);

// 毎週日曜日 0時の企業コード辞書更新（Playwright使用のためメモリ1GiB・タイムアウト300秒）
export const createCompanyDict2 = onSchedule(
  {
    schedule: "0 0 * * 0",
    timeZone: "Asia/Tokyo",
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async () => {
    await createCompanyDictHandler();
  }
);

// 毎日0時の決算発表スケジュール辞書更新
export const createSettlementDict = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: 120,
  },
  async () => {
    await createSettlementDictHandler();
  }
);

// 毎朝8時の当日決算予定通知送信
export const sendSettlementToTopic = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Asia/Tokyo",
    timeoutSeconds: 120,
  },
  async () => {
    await sendSettlementToTopicHandler();
  }
);

// --- 既存アプリ向け互換 HTTPS Functions (v1: us-central1 でそのまま維持) ---

export const listTopics = functions.https.onRequest(listTopicsHandler);
export const getDownloadUrlEdinet = functions.https.onRequest(getDownloadUrlEdinetHandler);

// --- 新アプリ向け HTTPS Functions (v2: 日本・東京リージョン asia-northeast1, concurrency 80) ---

export const listTopicsV2 = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    concurrency: 80,
  },
  listTopicsHandler
);

export const getDownloadUrlEdinetV2 = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    concurrency: 80,
    secrets: ["EDINET_API_KEY"],
  },
  getDownloadUrlEdinetHandler
);

// --- Cloud Functions v2: Firestore Triggers (Firestore が nam5 のため us-central1 を明示指定) ---

export const sendTopicFs2 = onDocumentCreated(
  {
    document: "disclosures/{key}",
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await sendTopicHandler(snap as any, { params: event.params });
  }
);

export const saveDocumentFs = onDocumentCreated(
  {
    document: "disclosures/{key}",
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await saveDocumentHandler(snap as any, { params: event.params });
  }
);

export const sendEdinetToTopic = onDocumentCreated(
  {
    document: "edinets/{key}",
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await sendEdinetToTopicHandler(snap as any, { params: event.params });
  }
);

// --- Cloud Functions v1: Analytics Trigger (v2 に直接の後継トリガーがないため維持) ---

export const handleContentViewEvent = functions.analytics
  .event("select_content")
  .onLog(handleContentViewEventHandler);
