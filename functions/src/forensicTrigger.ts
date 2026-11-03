import * as admin from "firebase-admin";
import axios from "axios";
import logger from "./lib/logger";
import { getEdinetApiKey } from "./lib/config";
import { ForensicAnalyzer } from "./forensic/analyzer";
import { DEFAULT_USER_AGENT } from "./lib/constants";

// 解析対象とする EDINET 書類コード: 有報(120), 訂正有報(130), 四半期(140), 半期(160)
const TARGET_EDINET_DOC_TYPES = ["120", "130", "140", "160"];

/**
 * EDINET 書類のフォレンジック解析ハンドラー
 */
export async function analyzeEdinetForensic(
  snapshot: admin.firestore.DocumentSnapshot,
  context?: { params?: { docId?: string } }
): Promise<boolean> {
  const data = snapshot.data();
  if (!data) return false;

  const docId = context?.params?.docId || data.docID || snapshot.id;
  const docTypeCode = data.docTypeCode;

  if (!docTypeCode || !TARGET_EDINET_DOC_TYPES.includes(docTypeCode)) {
    logger.info(`EDINET doc ${docId} (type: ${docTypeCode}) is not targeted for forensic analysis.`);
    return false;
  }

  // 既に解析済みの場合はスキップ
  if (data.forensic) {
    logger.info(`EDINET doc ${docId} already has forensic result.`);
    return true;
  }

  logger.info(`Starting forensic analysis for EDINET doc ${docId} (${data.filerName || ""})`);

  try {
    const apiKey = getEdinetApiKey();
    const url = `https://api.edinet-fsa.go.jp/api/v2/documents/${encodeURIComponent(docId)}?type=1`;

    const response = await axios.get(url, {
      headers: apiKey ? { "Ocp-Apim-Subscription-Key": apiKey } : {},
      responseType: "arraybuffer",
      timeout: 45000,
    });

    const zipBuffer = Buffer.from(response.data);
    const analyzer = new ForensicAnalyzer();
    const result = await analyzer.analyzeZip(zipBuffer, false);

    await snapshot.ref.set(
      {
        forensic: result,
      },
      { merge: true }
    );

    logger.info(
      `Completed forensic analysis for EDINET doc ${docId}: riskLevel=${result.riskLevel}, tags=${result.tags.join(",")}`
    );
    return true;
  } catch (err: any) {
    logger.error(`Failed to analyze EDINET doc ${docId}:`, err);
    return false;
  }
}

/**
 * TDnet 適時開示のフォレンジック解析ハンドラー
 */
export async function analyzeTdnetForensic(
  snapshot: admin.firestore.DocumentSnapshot,
  _context?: any
): Promise<boolean> {
  const data = snapshot.data();
  if (!data) return false;

  const xbrlFile = data.xbrl;
  if (!xbrlFile || typeof xbrlFile !== "string" || !xbrlFile.endsWith(".zip")) {
    // XBRL ZIP が付与されていない開示はスキップ
    return false;
  }

  // 既に解析済みの場合はスキップ
  if (data.forensic) {
    logger.info(`TDnet doc ${snapshot.id} already has forensic result.`);
    return true;
  }

  logger.info(
    `Starting forensic analysis for TDnet doc ${snapshot.id} (${data.company || ""}: ${data.title || ""}) with XBRL: ${xbrlFile}`
  );

  try {
    const url = `https://www.release.tdnet.info/inbs/${encodeURIComponent(xbrlFile)}`;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });

    const zipBuffer = Buffer.from(response.data);
    const analyzer = new ForensicAnalyzer();
    const result = await analyzer.analyzeZip(zipBuffer, true);

    await snapshot.ref.set(
      {
        forensic: result,
      },
      { merge: true }
    );

    logger.info(
      `Completed forensic analysis for TDnet doc ${snapshot.id}: riskLevel=${result.riskLevel}, tags=${result.tags.join(",")}`
    );
    return true;
  } catch (err: any) {
    logger.error(`Failed to analyze TDnet doc ${snapshot.id}:`, err);
    return false;
  }
}
