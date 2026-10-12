import * as functions from "firebase-functions/v1";
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

export const saveDocument = async (
  snapshot: functions.firestore.DocumentSnapshot,
  context?: functions.EventContext
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
  const filePath = `${DB_PATH}/${document}.pdf`;
  const url = `https://www.release.tdnet.info/inbs/${document}.pdf`;

  logger.info(`Downloading and saving document: ${filePath} from ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });

    const ws = myBucket.file(filePath).createWriteStream({
      gzip: true,
      metadata: {
        contentType: "application/pdf",
      },
    });

    await pipeline(response.data, ws);
    logger.info(`Successfully saved ${filePath}`);
    return true;
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      logger.warn(`TDnet document not found (404): ${url}`);
      return false;
    }
    logger.error(`Failed to download or save document ${filePath}:`, err);
    throw err;
  }
};

export default saveDocument;
