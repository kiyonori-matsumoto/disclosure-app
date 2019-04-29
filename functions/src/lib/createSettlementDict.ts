import * as admin from "firebase-admin";
import * as rp from "request-promise-native";
import * as cheerio from "cheerio";
import * as xlsx from "xlsx";
import * as _ from "lodash";
import { URL } from "url";

export const createSettlementDict = (DB_PATH: string) => async () => {
  const resIndex = await rp.get(
    "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
  );
  const $ = cheerio.load(resIndex);

  const urls = $("table.overtable a")
    .map((i, elem) => elem.attribs["href"])
    .get() as string[];

  const registerObjects = (url: string) => {
    const xlsxUrl = new URL(url, "https://www.jpx.co.jp");
    return (
      rp
        .get(xlsxUrl.toString(), { encoding: null })
        .then(res => xlsx.read(res, { cellText: false, cellDates: true }))
        // .then(wb => console.log(wb) || wb)
        .then(wb =>
          xlsx.utils.sheet_to_json<{ [key: string]: any }>(
            wb.Sheets[wb.SheetNames[0]],
            {
              range: 2,
              raw: false,
              dateNF: 'yyyy"-"mm"-"dd'
            }
          )
        )
        .then(obj => {
          return obj
            .filter(e => (e["発表予定日"] as string).match(/\d{4}-\d{2}-\d{2}/))
            .map(e => {
              // const schedule = ((v: string) =>
              //   v.match(/\d{4}-\d{2}-\d{2}/) ? v : "2000-01-01")(e["発表予定日"]);
              return {
                code: e["コード"],
                schedule: e["発表予定日"],
                name: e["会社名"],
                settlementDate: e["決算期末"],
                quote: e["種別"]
              };
            });
        })
    );
  };

  const objs = await Promise.all(urls.map(registerObjects));

  // 500件毎にデータをまとめる(firestoreの書き込み制限)
  const _allData = _.flatten(objs).filter(e => !!e.code);
  console.log(`total datas to register: ${_allData.length}`);

  const datas = _.chunk(_allData, 500);

  const transaction = datas.map(d => {
    const batch = admin.firestore().batch();
    d.forEach(_d =>
      batch.set(
        admin
          .firestore()
          .collection(DB_PATH)
          .doc(_d.code),
        _d,
        { merge: true }
      )
    );
    return batch.commit();
  });

  return Promise.all(transaction);
};

// createSettlementDict("dev-xxx")().then(console.log);
