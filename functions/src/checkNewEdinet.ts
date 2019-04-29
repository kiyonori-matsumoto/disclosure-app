import * as rp from "request-promise-native";
import * as moment from "moment";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as _ from "lodash";
import { zeroPad, notEmpty } from "./lib/util";

const DB_PATH = "edinets";

const fetchAndMapEdinet = async (date: string) => {
  const payload = await rp.get(
    `https://disclosure.edinet-fsa.go.jp/api/v1/documents.json?date=${date}&type=2`,
    { rejectUnauthorized: false, json: true }
  );
  return (payload.results as any[])
    .map((result: { [key: string]: any }) => {
      try {
        const {
          seqNumber,
          docID,
          edinetCode,
          filerName,
          ordinanceCode,
          formCode,
          docTypeCode,
          submitDateTime,
          docDescription,
          issuerEdinetCode,
          subjectEdinetCode,
          subsidiaryEdinetCode,
          pdfFlag
        } = result;
        const [dateStr] = submitDateTime.split(" ");
        const time = moment(submitDateTime).unix();
        const subsidiaryEdinetCodes =
          subsidiaryEdinetCode === null
            ? []
            : (subsidiaryEdinetCode as string).split(",");
        const map: { [key: string]: number } = { [edinetCode]: time };
        if (issuerEdinetCode !== null) {
          map[issuerEdinetCode] = time;
        }

        if (subjectEdinetCode !== null) {
          map[subjectEdinetCode] = time;
        }

        if (subsidiaryEdinetCodes.length > 0) {
          subsidiaryEdinetCodes.forEach(c => (map[c] = time));
        }

        return {
          seq: `${dateStr}-${zeroPad(seqNumber, 5)}`,
          time,
          seqNumber,
          docID,
          edinetCode,
          filerName,
          ordinanceCode,
          formCode,
          docTypeCode,
          docDescription,
          issuerEdinetCode,
          subjectEdinetCode,
          subsidiaryEdinetCode,
          pdfFlag,
          map
        };
      } catch (e) {
        console.error(e);
        console.log("document is", result);
        return null;
      }
    })
    .filter(notEmpty);
};

const checkNewEdinet = async (
  message?: functions.pubsub.Message,
  context?: { timestamp: string }
) => {
  const time_msg = _.get(message, "json.timestamp");
  const today = moment(time_msg ? time_msg : context!.timestamp).utcOffset(9);
  const start = today.startOf("days").format("YYYY-MM-DD");
  const end = today
    .startOf("days")
    .add(1, "day")
    .format("YYYY-MM-DD");

  console.log(`viewing: ${today.format("llll")}, start: ${start}, end: ${end}`);

  const getLastEdinetDoc = () =>
    admin
      .firestore()
      .collection(DB_PATH)
      .where("seq", ">=", start)
      .where("seq", "<", end)
      .orderBy("seq", "desc")
      .limit(1)
      .get();

  const [data, lastEdinetDoc] = await Promise.all([
    fetchAndMapEdinet(start),
    getLastEdinetDoc()
  ]);

  const lastSeqNumber = lastEdinetDoc.empty
    ? 0
    : lastEdinetDoc.docs[0].data().seqNumber;

  console.log(
    `lastSeqNumber = ${lastSeqNumber}, currentSeqNumber = ${
      data.length > 0 ? data[data.length - 1].seqNumber : "-"
    }`
  );

  const saveData = _.chunk(data.filter(e => e.seqNumber > lastSeqNumber), 500);

  console.log(`trying to write ${_.get(saveData, "[0].length")} files`);

  const transaction = saveData.map(d => {
    const batch = admin.firestore().batch();
    d.forEach(_d =>
      batch.set(
        admin
          .firestore()
          .collection(DB_PATH)
          .doc(_d.docID),
        _d
      )
    );
    return batch.commit();
  });

  return Promise.all(transaction);
};

export default checkNewEdinet;
