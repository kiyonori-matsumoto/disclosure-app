import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { notEmpty } from "./lib/util";

let companies: any = null;

const sendEdinetToTopic = async (
  snapshot: functions.firestore.DocumentSnapshot,
  _: functions.EventContext
) => {
  const data = snapshot.data();
  if (data === undefined) {
    return true;
  }
  const { docDescription, map, noSend } = data;
  console.log(docDescription, map, noSend);

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
    .map(key => {
      const company = companies[key];
      if (!company) return null;
      const code = company.code.substring(0, 4);

      return {
        notification: {
          body: docDescription,
          tag: `code_${code}`,
          color: "#006064",
          title: `新しいEdinet ${company.name}(${code})`
        },
        data: {
          title: docDescription,
          code,
          company: company.name,
          click_action: "FLUTTER_NOTIFICATION_CLICK"
        },
        topic: `'code_${code} in topics && '/topics/edinet' in topics`
      };
    })
    .filter(notEmpty)
    .map(d => admin.messaging().send(d, true));

  return Promise.all(promises).then(console.log);
};

export default sendEdinetToTopic;
