import * as functions from "firebase-functions/v1";
import { logger } from "./lib/logger";

export const TAGS = [
  "株主優待",
  "決算",
  "配当",
  "業績予想",
  "日々の開示事項",
  "自己株式",
  "新株",
  "短信",
];

export const addTag = async (
  doc: functions.firestore.DocumentSnapshot,
  context?: functions.EventContext
): Promise<FirebaseFirestore.WriteResult | null> => {
  const data = doc.data();
  if (!data || typeof data.title !== "string") {
    logger.info("No title found in document, skipping tag extraction");
    return null;
  }

  const tags = TAGS.filter((e) => data.title.includes(e)).reduce<Record<string, boolean>>(
    (acc, tag) => {
      acc[tag] = true;
      return acc;
    },
    {}
  );

  logger.info(`Extracted tags for document ${doc.id}: ${JSON.stringify(tags)}`);

  return doc.ref.update({ tags });
};

export default addTag;
