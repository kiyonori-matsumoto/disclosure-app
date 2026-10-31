import { chromium } from "playwright";
import * as os from "os";
import * as fs from "fs";
import * as unzipper from "unzipper";
import * as path from "path";
import iconv from "iconv-lite";
import { parse } from "csv-parse/sync";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { logger } from "./lib/logger";

export interface CompanyDictEntry {
  edinetCode: string;
  classification: string;
  hasConsolidated: string;
  capital: string;
  closingDate: string;
  name: string;
  nameEn: string;
  nameKana: string;
  industory: string;
  code: string;
  corporateNumber: string;
}

export const parseCompanyDictCsv = (csvBuffer: Buffer): CompanyDictEntry[] => {
  const dataUtf = iconv.decode(csvBuffer, "Shift_JIS").toString().normalize("NFKC");
  const csv: string[][] = parse(dataUtf, {
    relax_column_count: true,
  });

  return csv
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
        code: code ? code.substring(0, 4) : "",
        corporateNumber,
      };
    })
    .filter((l) => Boolean(l.code));
};

export const downloadFile = async (destZipPath: string): Promise<string> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto("https://disclosure2.edinet-fsa.go.jp/weee0010.aspx", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await page.click("#GridContainerRow_0001 a");
    await page.waitForTimeout(1000);

    const download = await downloadPromise;
    await download.saveAs(destZipPath);
    logger.info(`Downloaded EDINET zip to ${destZipPath}`);
    return destZipPath;
  } finally {
    await browser.close().catch((err) => {
      logger.warn("Error closing browser:", err);
    });
  }
};

export const generateCompanyDict = async (workDir: string = os.tmpdir()): Promise<void> => {
  const zipPath = path.join(workDir, `edinet-${Date.now()}.zip`);
  const csvPath = path.join(workDir, "EdinetcodeDlInfo.csv");

  try {
    const downloadPath = await downloadFile(zipPath);
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(downloadPath)
        .pipe(unzipper.Extract({ path: workDir }))
        .on("close", () => {
          logger.info(`Extracted EDINET zip to ${workDir}`);
          resolve();
        })
        .on("error", reject);
    });

    if (!fs.existsSync(csvPath)) {
      throw new Error(`Extracted file not found: ${csvPath}`);
    }

    const data = fs.readFileSync(csvPath);
    const dict = parseCompanyDictCsv(data);
    logger.info(`Parsed ${dict.length} companies with stock code`);

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
    logger.info("Successfully uploaded companies.json to storage buckets");
  } finally {
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        logger.info(`Cleaned up temporary zip file: ${zipPath}`);
      }
    } catch (err) {
      logger.warn(`Failed to clean up ${zipPath}:`, err);
    }

    try {
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
        logger.info(`Cleaned up temporary csv file: ${csvPath}`);
      }
    } catch (err) {
      logger.warn(`Failed to clean up ${csvPath}:`, err);
    }
  }
};

export const createCompanyDict = async (
  _message?: functions.pubsub.Message,
  _context?: functions.EventContext,
  workDir: string = os.tmpdir()
): Promise<void> => {
  return generateCompanyDict(workDir);
};

export default createCompanyDict;

if (require.main === module) {
  const tmpDir = os.tmpdir();
  void downloadFile(`${tmpDir}/edinet.zip`);
}
