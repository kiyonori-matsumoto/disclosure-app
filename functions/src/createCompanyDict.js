const admin = require("firebase-admin");
const csvParse = require("csv-parse/lib/sync");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("request");
const encoding = require("encoding");
const unzipper = require("unzipper");

const tmpDir = os.tmpdir();

const createCompanyDict = () => {
  return request(
    "https://disclosure.edinet-fsa.go.jp/E01EW/download?uji.verb=W1E62071EdinetCodeDownload&uji.bean=ee.bean.W1E62071.EEW1E62071Bean&TID=W1E62071&PID=W1E62071&downloadFileName=&lgKbn=2&dflg=0&iflg=0&dispKbn=1",
    { rejectUnauthorized: false }
  )
    .pipe(unzipper.Extract({ path: tmpDir }))
    .on("close", () => {
      console.log("unzipped");
    })
    .promise()
    .then(() => {
      const data = fs.readFileSync(path.join(tmpDir, "EdinetcodeDlInfo.csv"));
      const data_utf = encoding
        .convert(data, "UTF-8", "SHIFT_JIS", true)
        .toString()
        .normalize("NFKC");
      const csv = csvParse(data_utf, {
        relax_column_count: true
      });

      return csv
        .slice(2)
        .map(line => {
          const [
            edinetCode,
            type,
            classification,
            hasConsolidated,
            capital,
            closingDate,
            name,
            nameEn,
            nameKana,
            address,
            industory,
            code,
            corporateNumber
          ] = line;
          return {
            edinetCode,
            // type,
            classification,
            hasConsolidated,
            capital,
            closingDate,
            name,
            nameEn,
            nameKana,
            // address,
            industory,
            code,
            corporateNumber
          };
        })
        .filter(l => l.code);
    })
    .then(obj => JSON.stringify(obj))
    .then(jsonStr =>
      admin
        .storage()
        .bucket()
        .file("companies.json")
        .save(jsonStr, { gzip: true })
    );
};

module.exports = createCompanyDict;
