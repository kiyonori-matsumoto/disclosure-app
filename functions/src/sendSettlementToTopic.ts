import * as admin from "firebase-admin";
import moment from "moment";

const settlementToStr = (d: any) =>
  `${d["name"]}の決算(${d["quote"]})は本日の予定です！`;

const sendSettlementToTopic = async () => {
  const dateStr = moment().utcOffset(9).format("YYYY-MM-DD");
  const settlements = await admin
    .firestore()
    .collection("settlements")
    .where("schedule", "==", dateStr)
    .get();
  const messages = settlements.docs.map((st) => {
    const data = st.data();
    return {
      notification: {
        body: settlementToStr(data),
        tag: `code_${data.code}`,
        color: "#006064",
        title: `決算予定情報 ${data.name}(${data.code})`,
      },
      data: {
        code: `${data.code}`,
        company: `${data.name}`,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };
  });
  console.log(`sending ${messages.length} messages`);
  console.log(messages[0]);
  const results = await Promise.allSettled(
    messages.map((msg) =>
      admin.messaging().send({
        topic: msg.notification.tag,
        notification: msg.notification,
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
      console.error(
        `FCM send failed for settlement code ${messages[i]?.data?.code}:`,
        res.reason
      );
    }
  });
  console.log(
    `FCM sendSettlementToTopic completed: ${succeeded} succeeded, ${failed} failed`
  );
  return results;
};

export default sendSettlementToTopic;
