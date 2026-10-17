import * as functions from "firebase-functions/v1";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();

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
import changeTopicHandler from "./changeTopic";

// --- Cloud Functions v2: Scheduled Functions (Cloud Scheduler 連携) ---

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

// --- Cloud Functions v2: HTTPS Functions (同時実行性 concurrency を活用しコールドスタート抑制) ---

export const listTopics = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    concurrency: 80,
  },
  listTopicsHandler
);

export const getDownloadUrlEdinet = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    concurrency: 80,
  },
  getDownloadUrlEdinetHandler
);

// --- Cloud Functions v1: Background Triggers (Firestore / RTDB / Analytics) ---

export const sendTopicFs2 = functions.firestore
  .document("disclosures/{key}")
  .onCreate(sendTopicHandler);

export const saveDocumentFs = functions.firestore
  .document("disclosures/{key}")
  .onCreate(saveDocumentHandler);

export const sendEdinetToTopic = functions.firestore
  .document("edinets/{key}")
  .onCreate(sendEdinetToTopicHandler);

export const changeTopic = functions.database
  .ref("/user/topics/{userId}")
  .onWrite(changeTopicHandler);

export const handleContentViewEvent = functions.analytics
  .event("select_content")
  .onLog(handleContentViewEventHandler);
