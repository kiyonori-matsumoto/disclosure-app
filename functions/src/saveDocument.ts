import * as admin from "firebase-admin";
import axios from "axios";
import { pipeline } from "stream/promises";
import logger from "./lib/logger";
import { DEFAULT_USER_AGENT } from "./lib/constants";

const DB_PATH = "disclosures";
const DOC_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const getStorageBucket = () => {
  if (process.env.FIREBASE_CONFIG) {
    try {
      const config = JSON.parse(process.env.FIREBASE_CONFIG);
      if (config.storageBucket) {
        return admin.storage().bucket(config.storageBucket);
      }
    } catch {
      // ignore parse error and fall back
    }
  }
  return admin.storage().bucket();
};

export interface SaveDocumentOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createSaveDocument = (
  dbPath: string = DB_PATH,
  options: SaveDocumentOptions = {}
) => async (
  snapshot: admin.firestore.DocumentSnapshot,
  _context?: any
) => {
  const data = snapshot.data();
  const document = data?.document;

  if (!document || typeof document !== "string") {
    logger.info("No valid document property found in snapshot");
    return true;
  }

  if (!DOC_REGEX.test(document)) {
    logger.warn(`Invalid document identifier: ${document}`);
    return false;
  }

  const myBucket = getStorageBucket();
  const filePath = `${dbPath}/${document}.pdf`;
  const url = `https://www.release.tdnet.info/inbs/${document}.pdf`;

  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let ws: NodeJS.WritableStream | undefined;
    try {
      logger.info(
        `Downloading and saving document: ${filePath} from ${url} (attempt ${attempt}/${maxRetries})`
      );

      const response = await axios.get(url, {
        responseType: "stream",
        timeout: 30000,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });

      ws = myBucket.file(filePath).createWriteStream({
        gzip: true,
        metadata: {
          contentType: "application/pdf",
        },
      });

      await pipeline(response.data, ws);
      logger.info(`Successfully saved ${filePath}`);
      return true;
    } catch (err: any) {
      if (ws && typeof (ws as any).destroy === "function") {
        try {
          (ws as any).destroy();
        } catch {
          // ignore
        }
      }

      if (axios.isAxiosError(err) && err.response?.status === 404) {
        logger.warn(`TDnet document not found (404): ${url}`);
        return false;
      }

      if (
        axios.isAxiosError(err) &&
        err.response?.status &&
        err.response.status >= 400 &&
        err.response.status < 500 &&
        err.response.status !== 429
      ) {
        logger.error(
          `Non-retryable client error (${err.response.status}) downloading ${filePath}:`,
          err
        );
        return false;
      }

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) {
        logger.error(
          `Failed to download or save document ${filePath} after ${maxRetries} attempts:`,
          err
        );
        throw err;
      }

      const jitter = Math.floor(Math.random() * 500);
      const delay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
      logger.warn(
        `Failed attempt ${attempt}/${maxRetries} to download ${filePath} (${err?.message || err}). Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  return false;
};

export const saveDocument = createSaveDocument("disclosures");
export default saveDocument;
