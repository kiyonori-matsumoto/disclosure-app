import * as admin from "firebase-admin";
import * as cheerio from "cheerio";
import ExcelJS from "exceljs";
import { URL } from "url";
import axios from "axios";
import { chunk } from "./util";
import logger from "./logger";
import { DEFAULT_USER_AGENT } from "./constants";

export interface SettlementRecord {
  code: string;
  schedule: string;
  name: string;
  settlementDate: string;
  quote: string;
}

export const formatDate = (date: unknown): string => {
  if (!date) return "";
  if (date instanceof Date) {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}月${day}日`;
  }
  const str = String(date).trim();
  const parts = str.split("-").map(Number);
  if (parts.length >= 3 && parts[1] && parts[2]) {
    return `${parts[1]}月${parts[2]}日`;
  }
  return str;
};

export const formatScheduleDate = (val: unknown): string => {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  return "";
};

export const extractText = (val: unknown): string => {
  if (val == null) return "";
  if (typeof val === "object" && val !== null && "text" in (val as any)) {
    return String((val as any).text).trim();
  }
  return String(val).trim();
};

export const createSettlementDict = (DB_PATH: string) => async () => {
  const resIndex = await axios.get(
    "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html",
    {
      timeout: 30000,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
      },
    }
  );
  const $ = cheerio.load(resIndex.data);

  const urls = $("table.overtable a")
    .map((i, elem) => elem.attribs["href"])
    .get();

  const registerObjects = async (url: string): Promise<SettlementRecord[]> => {
    try {
      const xlsxUrl = new URL(url, "https://www.jpx.co.jp");
      const res = await axios.get(xlsxUrl.toString(), {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
      });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.data);
      const ws = wb.worksheets[0];
      if (!ws) {
        return [];
      }

      let headerRowNumber = 0;
      const headerColIndices: Partial<Record<keyof SettlementRecord, number>> = {};

      for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
        const row = ws.getRow(r);
        let foundCode = false;

        row.eachCell((cell) => {
          const text = cell.text || extractText(cell.value);
          if (/コード/.test(text)) {
            foundCode = true;
          }
        });

        if (foundCode) {
          headerRowNumber = r;
          row.eachCell((cell, colNumber) => {
            const text = cell.text || extractText(cell.value);
            if (/コード/.test(text)) headerColIndices.code = colNumber;
            if (/発表予定日/.test(text)) headerColIndices.schedule = colNumber;
            if (/会社名/.test(text)) headerColIndices.name = colNumber;
            if (/決算期末/.test(text)) headerColIndices.settlementDate = colNumber;
            if (/種別/.test(text)) headerColIndices.quote = colNumber;
          });
          break;
        }
      }

      if (
        !headerRowNumber ||
        !headerColIndices.code ||
        !headerColIndices.schedule ||
        !headerColIndices.name ||
        !headerColIndices.settlementDate ||
        !headerColIndices.quote
      ) {
        logger.warn("Could not find expected headers in Excel sheet", { url });
        return [];
      }

      const records: SettlementRecord[] = [];
      for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const scheduleRaw = row.getCell(headerColIndices.schedule).value;
        const schedule = formatScheduleDate(scheduleRaw);
        if (!schedule) continue;

        const codeRaw = row.getCell(headerColIndices.code).value;
        const code = extractText(codeRaw);
        if (!code) continue;

        const name = extractText(row.getCell(headerColIndices.name).value);
        const settlementDate = formatDate(
          row.getCell(headerColIndices.settlementDate).value
        );
        const quote = extractText(row.getCell(headerColIndices.quote).value);

        records.push({
          code,
          schedule,
          name,
          settlementDate,
          quote,
        });
      }

      return records;
    } catch (error) {
      logger.error("Error registering objects in createSettlementDict:", error, {
        url,
      });
      return [];
    }
  };

  const objs = await Promise.all(urls.map(registerObjects));

  // 500件毎にデータをまとめる(firestoreの書き込み制限)
  const _allData = objs.flat().filter((e) => !!e.code);
  logger.info(`total datas to register in createSettlementDict: ${_allData.length}`);

  const datas = chunk(_allData, 500);

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
