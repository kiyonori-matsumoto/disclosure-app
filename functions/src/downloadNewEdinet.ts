import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import { pipeline } from "stream/promises";

const DB_PATH = "edinets";

// EDINET docID format: typically 8 alphanumeric characters (e.g. S100XXXX)
// Must not contain path separators, traversal dots, or special characters
const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

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

import { getEdinetApiKey } from "./lib/config";
import logger from "./lib/logger";

const getDownloadUrlEdinet = async (
  req: functions.Request,
  res: functions.Response
) => {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { docId } = req.query;

  if (!docId || typeof docId !== "string") {
    res.status(400).send("docId is required");
    return;
  }

  // Prevent path traversal and enforce alphanumeric docId
  if (!DOC_ID_REGEX.test(docId)) {
    res.status(400).send("Invalid docId format");
    return;
  }

  const myBucket = getStorageBucket();
  const documentPath = `${DB_PATH}/${docId}.pdf`;

  try {
    const [exists] = await myBucket.file(documentPath).exists();
    if (!exists) {
      const apiKey = getEdinetApiKey();
      if (!apiKey) {
        logger.warn(
          "EDINET_API_KEY is not configured in environment or Secret Manager. EDINET API download request may fail."
        );
      }
      const url = `https://api.edinet-fsa.go.jp/api/v2/documents/${encodeURIComponent(
        docId
      )}?type=2`;

      // download and save to storage with 30s timeout
      const response = await axios.get(url, {
        headers: apiKey ? { "Ocp-Apim-Subscription-Key": apiKey } : {},
        responseType: "stream",
        timeout: 30000,
      });

      if (response.headers["content-type"] !== "application/pdf") {
        res.status(404).send("not found");
        return;
      }

      const writer = myBucket.file(documentPath).createWriteStream();
      await pipeline(response.data, writer);
    }

    const [signedUrl] = await myBucket.file(documentPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    res.json({ signedUrl });
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      res.status(404).send("not found");
      return;
    }
    logger.error("Error downloading edinet document:", err, { docId });
    res.status(500).send("Internal Server Error");
  }
};

export default getDownloadUrlEdinet;
