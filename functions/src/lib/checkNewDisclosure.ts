import * as rp from "request-promise-native";
import * as cheerio from "cheerio";
import * as moment from "moment";

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { zeroPad } from "./util";

// const TIME_MAX = 9999999999999;
const TAGS = [
  "株主優待",
  "決算",
  "配当",
  "業績予想",
  "日々の開示事項",
  "自己株式",
  "新株"
];

const firestore = admin.firestore();
firestore.settings({ timestampsInSnapshots: true });

export const checkNewDisclosure = (DB_PATH: string) => async (
  snapshot: functions.pubsub.Message,
  context: functions.EventContext
) => {
  const time = moment(
    snapshot.attributes.timestampForTest || context.timestamp
  ).utcOffset(9);
  const start = moment(time)
    .utcOffset(9)
    .startOf("date")
    .valueOf();
  const end = moment(start)
    .utcOffset(9)
    .add(1, "days")
    .valueOf();
  console.log(`viewing: ${time.format("YYYYMMDD")}, ${start}, ${end}`);

  const lastDisclosures = await firestore
    .collection(DB_PATH)
    .orderBy("time", "desc")
    .where("time", ">=", start)
    .where("time", "<", end)
    .limit(1)
    .get();

  const lastDocuments = lastDisclosures.docs.map(doc => doc.data().document);
  const lastCount = lastDisclosures.docs
    .map(doc => doc.data().time % 1000)
    .reduce((a, e) => e, 0);
  console.log(`lastCount = ${lastCount}`);

  let matched = false;
  let count = 0;
  const batches: Promise<any>[] = [];

  for (let i = 1; i < 100; i++) {
    const batch = firestore.batch();

    let data;
    try {
      data = await rp.get(
        `https://www.release.tdnet.info/inbs/I_list_${zeroPad(
          i,
          3
        )}_${time.format("YYYYMMDD")}.html`
      );
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(err);
        if (matched) {
          throw err;
        }
        break;
      } else {
        throw err;
      }
    }
    const $ = cheerio.load(data);
    if (count === 0) {
      const countText = $(".kaijiSum").text();
      if (!countText) {
        console.log("no documents");
        return;
      }
      count = parseInt(
        ($(".kaijiSum")
          .text()
          .replace(/\s+/, "")
          .match(/全(\d+)件/) || [])[1]
      );
      console.log(`current count=${count}`);
      if (!count && count !== 0) {
        throw new RangeError("cannot get kaijiSum");
      }
    }
    const m = $("table#main-list-table tr");
    m.each((j, elem) => {
      const doc = (
        $(elem)
          .find(".kjTitle a")
          .attr("href") || "NOMATCH"
      ).replace(/\.pdf/, "");
      if (lastDocuments.indexOf(doc) < 0) {
        // not found.

        // save table data
        const t = $(elem)
          .find(".kjTime")
          .text()
          .split(":")
          .map(e => parseInt(e, 10));
        const code = $(elem)
          .find(".kjCode")
          .text()
          .slice(0, 4);
        const docTime =
          time
            .clone()
            .hour(t[0])
            .minute(t[1])
            .second(0)
            .millisecond(0)
            .valueOf() + count;
        const title = $(elem)
          .find(".kjTitle a")
          .text();
        const tags = TAGS.filter(e => title.match(e)).reduce<{
          [key: string]: boolean;
        }>((a, e) => {
          a[e] = true; //Todo: そのうち'docTime'に変更する;
          return a;
        }, {});
        const docData = {
          code: code,
          company: $(elem)
            .find(".kjName")
            .text(),
          title,
          tags,
          document: doc,
          exchanges: $(elem)
            .find(".kjPlace")
            .text()
            .trim(),
          time: docTime
        };
        count--;

        console.log(t, docData);

        batch.set(
          firestore.collection(DB_PATH).doc(docTime.toString(10)),
          docData
        );
        return true;
      } else {
        matched = true;
        return false;
      }
    });
    batches.push(batch.commit());
    if (matched || m.length !== 100) break;
  }
  return Promise.all(batches);
};
