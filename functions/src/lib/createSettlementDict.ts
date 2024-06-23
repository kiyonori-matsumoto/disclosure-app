import * as admin from "firebase-admin";
import * as cheerio from "cheerio";
import * as xlsx from "xlsx";
import * as _ from "lodash";
import { URL } from "url";
import axios from "axios";

export const createSettlementDict = (DB_PATH: string) => async () => {
  const resIndex = await axios.get(
    "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
  );
  const $ = cheerio.load(resIndex.data);

  const urls = $("table.overtable a")
    .map((i, elem) => elem.attribs["href"])
    .get() as string[];

  const formatDate = (date: string) => {
    if (!date) return "";

    const [, month, day] = date.split("-").map(Number);
    if (!month || !day) return date;

    return `${month}月${day}日`;
  };

  const registerObjects = async (url: string) => {
    try {
      const xlsxUrl = new URL(url, "https://www.jpx.co.jp");
      const res = await axios.get(xlsxUrl.toString(), {
        responseType: "arraybuffer",
      });
      const wb = xlsx.read(res.data, { cellText: false, cellDates: true });
      const sheetData = xlsx.utils.sheet_to_json<{ [key: string]: any }>(
        wb.Sheets[wb.SheetNames[0]],
        {
          range: 4,
          raw: false,
          dateNF: 'yyyy"-"mm"-"dd',
        }
      );

      if (sheetData.length === 0) {
        return [];
      }

      const keyMapping = {
        code: Object.keys(sheetData[0]).find((e) => e.match(/コード/))!,
        schedule: Object.keys(sheetData[0]).find((e) => e.match(/発表予定日/))!,
        name: Object.keys(sheetData[0]).find((e) => e.match(/会社名/))!,
        settlementDate: Object.keys(sheetData[0]).find((e) =>
          e.match(/決算期末/)
        )!,
        quote: Object.keys(sheetData[0]).find((e) => e.match(/種別/))!,
      };

      const filteredData = sheetData.filter((e) =>
        (e[keyMapping.schedule] as string).match(/\d{4}-\d{2}-\d{2}/)
      );

      const mappedData = filteredData.map((e) => ({
        code: e[keyMapping.code],
        schedule: e[keyMapping.schedule],
        name: e[keyMapping.name],
        settlementDate: formatDate(e[keyMapping.settlementDate]),
        quote: e[keyMapping.quote],
      }));
      console.log(mappedData.at(-1));
      return mappedData;
    } catch (error) {
      console.error("Error registering objects:", error);
      return [];
    }
  };

  const objs = await Promise.all(urls.map(registerObjects));

  // 500件毎にデータをまとめる(firestoreの書き込み制限)
  const _allData = _.flatten(objs).filter((e) => !!e.code);
  console.log(`total datas to register: ${_allData.length}`);

  const datas = _.chunk(_allData, 500);

  const transaction = datas.map((d) => {
    const batch = admin.firestore().batch();
    d.forEach((_d) =>
      batch.set(admin.firestore().collection(DB_PATH).doc(_d.code), _d, {
        merge: true,
      })
    );
    return batch.commit();
  });

  return Promise.all(transaction);
};

// createSettlementDict("dev-xxx")().then(console.log);
