import * as admin from "firebase-admin";
import { notEmpty } from "./lib/util";
import logger from "./lib/logger";

let companies: any = null;

const sendEdinetToTopic = async (
  snapshot: admin.firestore.DocumentSnapshot,
  _context?: any
) => {
  const data = snapshot.data();
  if (data === undefined) {
    return true;
  }
  const { docDescription, map, noSend } = data;
  logger.info("Processing sendEdinetToTopic trigger", {
    docDescription,
    noSend,
    mapKeys: Object.keys(map || {}),
  });

  if (noSend) {
    return true;
  }

  if (companies === null) {
    companies = await admin
      .storage()
      .bucket()
      .file("companies.json")
      .download()
      .then(([buffer]) => {
        const s = Buffer.from(buffer).toString("utf8");
        const c: any[] = JSON.parse(s);
        return c.reduce((a, e) => {
          if (!e.edinetCode) return a;
          a[e.edinetCode] = e;
          return a;
        }, {});
      });
  }

  const promises = Object.keys(map)
    .map((key) => {
      const company = companies[key];
      if (!company) return null;
      const code = company.code.substring(0, 4);

      const d = {
        notification: {
          body: docDescription,
          title: `新しいEdinet ${company.name}(${code})`,
        },
        android: {
          notification: {
            tag: `code_${code}`,
            color: "#006064",
          },
        },
        data: {
          title: docDescription,
          code,
          edinetCode: key,
          company: company.name,
          type: "edinet",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      };
      return admin.messaging().send({
        condition: `'code_${code}' in topics && 'edinet_notification' in topics`,
        notification: d.notification,
        android: d.android,
        data: d.data,
      });
    })
    .filter(notEmpty);

  const results = await Promise.allSettled(promises);
  let succeeded = 0;
  let failed = 0;
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      succeeded++;
    } else {
      failed++;
      logger.error(`FCM send failed for edinet message index ${i}:`, res.reason);
    }
  });
  logger.info(
    `FCM sendEdinetToTopic completed: ${succeeded} succeeded, ${failed} failed`
  );
  return results;
};

export default sendEdinetToTopic;
