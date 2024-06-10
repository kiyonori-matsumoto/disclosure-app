import { chromium } from "playwright";
import * as os from "os";
import * as fs from "fs";
import * as unzipper from "unzipper";
import path = require("path");
import * as iconv from "iconv-lite";
import { parse } from "csv-parse/sync";
import * as admin from "firebase-admin";

const tmpDir = os.tmpdir();
const targetPath = `${tmpDir}/edinet.zip`;

const downloadFile = async () => {
  // Launch the browser
  const browser = await chromium.launch();

  // goto "https://disclosure2.edinet-fsa.go.jp/weee0010.aspx"
  const page = await browser.newPage();
  await page.goto("https://disclosure2.edinet-fsa.go.jp/weee0010.aspx");

  //  click "#GridContainerRow_0001 a"
  const downloadPromise = page.waitForEvent("download");
  await page.click("#GridContainerRow_0001 a");
  await page.waitForTimeout(1000);

  const download = await downloadPromise;

  await download.saveAs(`${tmpDir}/edinet.zip`);

  console.log("Downloaded to", targetPath);

  // Close the browser
  await browser.close();

  return targetPath;
};

const createCompanyDict = async () => {
  const downloadPath = await downloadFile();
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(downloadPath)
      .pipe(unzipper.Extract({ path: tmpDir }))
      .on("close", () => {
        console.log("Extracted to", tmpDir);
        resolve();
      })
      .on("error", reject);
  });

  const data = fs.readFileSync(path.join(tmpDir, "EdinetcodeDlInfo.csv"));
  const data_utf = iconv.decode(data, "Shift_JIS").toString().normalize("NFKC");

  const csv: string[][] = parse(data_utf, {
    relax_column_count: true,
  });

  const dict = csv
    .slice(2)
    .map((line) => {
      const [
        edinetCode,
        ,
        classification,
        hasConsolidated,
        capital,
        closingDate,
        name,
        nameEn,
        nameKana,
        ,
        industory,
        code,
        corporateNumber,
      ] = line;
      return {
        edinetCode,
        classification,
        hasConsolidated,
        capital,
        closingDate,
        name,
        nameEn,
        nameKana,
        industory,
        code,
        corporateNumber,
      };
    })
    .filter((l) => l.code);

  const jsonStr = JSON.stringify(dict, null, 2);

  await Promise.all([
    admin.storage().bucket().file("companies.json").save(jsonStr, {
      gzip: true,
      contentType: "application/json",
    }),
    admin
      .storage()
      .bucket("disclosure-app-2")
      .file("companies.json")
      .save(jsonStr, {
        gzip: true,
        contentType: "application/json",
      }),
  ]);
};

export default createCompanyDict;

// if main module, run the function
if (require.main === module) {
  void downloadFile();
}
