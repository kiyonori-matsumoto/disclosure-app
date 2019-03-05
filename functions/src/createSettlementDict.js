const admin = require("firebase-admin");
const rp = require("request-promise-native");
const moment = require("moment");

const xlsx = require("xlsx");

const createSettlementDict = () => {
  return rp
    .get(
      "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan01_0301.xls",
      { encoding: null }
    )
    .then(res => xlsx.read(res, { cellText: false, cellDates: true }))
    .then(wb => console.log(wb) || wb)
    .then(wb =>
      xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        range: 2,
        raw: false,
        dateNF: 'yyyy"-"mm"-"dd'
      })
    )
    .then(obj =>
      obj.map(e => ({
        code: e["コード"],
        schedule: e["発表予定日"],
        name: e["会社名"],
        settlementDate: e["決算期末"],
        quote: e["種別"]
      }))
    );
  //   .then(console.log)
  //   const wb = xlsx.readFile("/home/kiyonori/Downloads/kessan01_0301.xls");
  //   console.log(wb);
  //   return wb;
};

createSettlementDict().then(console.log);
// module.exports = createSettlementDict;
