import * as admin from "firebase-admin";
import * as moment from "moment";

const settlementToStr = (d: any) =>
  `${d["name"]}の決算(${d["quote"]})は本日の予定です！`;

const sendSettlementToTopic = async () => {
  const dateStr = moment()
    .utcOffset(9)
    .format("YYYY-MM-DD");
  const settlements = await admin
    .firestore()
    .collection("settlements")
    .where("schedule", "==", dateStr)
    .get();
  const messages = settlements.docs.map(st => {
    const data = st.data();
    return {
      notification: {
        body: settlementToStr(data),
        tag: `code_${data.code}`,
        color: "#006064",
        title: `決算予定情報 ${data.name}(${data.code})`
      },
      data: {
        code: `${data.code}`,
        company: `${data.name}`,
        click_action: "FLUTTER_NOTIFICATION_CLICK"
      }
    };
  });
  console.log(messages);
};

export default sendSettlementToTopic;
