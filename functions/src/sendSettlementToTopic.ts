import * as admin from "firebase-admin";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import logger from "./lib/logger";

dayjs.extend(utc);

const settlementToStr = (d: any) =>
  `${d["name"]}の決算(${d["quote"]})は本日の予定です！`;

const sendSettlementToTopic = async () => {
  const dateStr = dayjs().utcOffset(9).format("YYYY-MM-DD");
  const settlements = await admin
    .firestore()
    .collection("settlements")
    .where("schedule", "==", dateStr)
    .get();
  const messages = settlements.docs.map((st) => {
    const data = st.data();
    return {
      topic: `code_${data.code}`,
      notification: {
        body: settlementToStr(data),
        title: `決算予定情報 ${data.name}(${data.code})`,
      },
      android: {
        notification: {
          tag: `code_${data.code}`,
          color: "#006064",
        },
      },
      data: {
        code: `${data.code}`,
        company: `${data.name}`,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };
  });
  logger.info(`Sending ${messages.length} settlement notifications for ${dateStr}`);
  const results = await Promise.allSettled(
    messages.map((msg) =>
      admin.messaging().send({
        topic: msg.topic,
        notification: msg.notification,
        android: msg.android,
        data: msg.data,
      })
    )
  );

  let succeeded = 0;
  let failed = 0;
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      succeeded++;
    } else {
      failed++;
      logger.error(
        `FCM send failed for settlement code ${messages[i]?.data?.code}:`,
        res.reason
      );
    }
  });
  logger.info(
    `FCM sendSettlementToTopic completed: ${succeeded} succeeded, ${failed} failed`
  );
  return results;
};

export default sendSettlementToTopic;
