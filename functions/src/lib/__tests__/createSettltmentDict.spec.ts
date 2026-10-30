import "jest";

import * as fs from "fs";

jest.mock("firebase-admin");
jest.mock("axios");

import * as admin from "firebase-admin";
import ExcelJS from "exceljs";

import {
  createSettlementDict,
  formatDate,
  formatScheduleDate,
  extractText,
} from "../createSettlementDict";
import axios from "axios";

const indexHtml = fs.readFileSync(__dirname + "/res/index.html");
const kessan04 = fs.readFileSync(__dirname + "/res/kessan04_0607.xlsx"); // 2250data, 未定=91
const kessan05 = fs.readFileSync(__dirname + "/res/kessan05_0621.xlsx"); // 451data, 未定=8

describe("lib/createSettlementDict", () => {
  beforeEach(() => {
    (axios.get as any) = jest.fn().mockImplementation((url, _option) => {
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
      ) {
        return Promise.resolve({ data: indexHtml });
      }
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan04_0607.xlsx"
      ) {
        return Promise.resolve({ data: kessan04 });
      }
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan05_0621.xlsx"
      ) {
        return Promise.resolve({ data: kessan05 });
      }
      return Promise.reject("not found");
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("can execute", async () => {
    await createSettlementDict("test-settlement")();
    expect(admin.firestore().batch().set).toBeCalledTimes(659);
    expect(admin.firestore().collection("d").doc).toBeCalledTimes(659);
    expect(admin.firestore().batch().set).nthCalledWith(
      1,
      expect.anything(),
      {
        code: "4707",
        schedule: "2024-05-24",
        name: "キタック",
        settlementDate: "10月20日",
        quote: "第２四半期",
      },
      { merge: true }
    );
    expect(admin.firestore().collection("d").doc).nthCalledWith(1, "4707");
    expect(admin.firestore().collection("d").doc).nthCalledWith(172, "4075");
    expect(admin.firestore().batch().set).nthCalledWith(
      172,
      expect.anything(),
      {
        code: "4075",
        schedule: "2024-06-14",
        name: "ブレインズテクノロジー",
        settlementDate: "7月31日",
        quote: "第３四半期",
      },
      { merge: true }
    );
    expect(admin.firestore().batch().commit).toBeCalledTimes(2);
  });

  describe("helper functions", () => {
    describe("formatDate", () => {
      it("formats UTC Date object correctly", () => {
        const date = new Date(Date.UTC(2024, 9, 20)); // October 20
        expect(formatDate(date)).toBe("10月20日");
      });

      it("formats YYYY-MM-DD string correctly", () => {
        expect(formatDate("2024-05-24")).toBe("5月24日");
        expect(formatDate("2024-12-01")).toBe("12月1日");
      });

      it("returns non-date string as is", () => {
        expect(formatDate("未定")).toBe("未定");
      });

      it("handles falsy values", () => {
        expect(formatDate(null)).toBe("");
        expect(formatDate(undefined)).toBe("");
        expect(formatDate("")).toBe("");
      });
    });

    describe("formatScheduleDate", () => {
      it("formats UTC Date object to YYYY-MM-DD", () => {
        const date = new Date(Date.UTC(2024, 4, 24)); // May 24
        expect(formatScheduleDate(date)).toBe("2024-05-24");
      });

      it("returns valid YYYY-MM-DD string unchanged", () => {
        expect(formatScheduleDate("2024-05-24")).toBe("2024-05-24");
      });

      it("rejects non-conforming or pending values", () => {
        expect(formatScheduleDate("未定")).toBe("");
        expect(formatScheduleDate("2024/05/24")).toBe("");
        expect(formatScheduleDate("24-05-2024")).toBe("");
        expect(formatScheduleDate(null)).toBe("");
        expect(formatScheduleDate(undefined)).toBe("");
      });
    });

    describe("extractText", () => {
      it("extracts text from strings and numbers", () => {
        expect(extractText("4707")).toBe("4707");
        expect(extractText(4707)).toBe("4707");
        expect(extractText("  キタック  ")).toBe("キタック");
      });

      it("extracts text from rich text / cell objects", () => {
        expect(extractText({ text: "キタック" })).toBe("キタック");
      });

      it("handles null and undefined", () => {
        expect(extractText(null)).toBe("");
        expect(extractText(undefined)).toBe("");
      });
    });
  });

  describe("error and edge cases handling", () => {
    it("handles HTTP download failure gracefully and processes remaining sheets", async () => {
      (axios.get as any) = jest.fn().mockImplementation((url) => {
        if (
          url ===
          "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
        ) {
          return Promise.resolve({ data: indexHtml });
        }
        if (
          url ===
          "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan04_0607.xlsx"
        ) {
          return Promise.reject(new Error("Network timeout"));
        }
        if (
          url ===
          "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan05_0621.xlsx"
        ) {
          return Promise.resolve({ data: kessan05 });
        }
        return Promise.reject("not found");
      });

      await createSettlementDict("test-settlement")();

      // Only kessan05 should be processed without crashing
      expect(admin.firestore().batch().set).toBeCalled();
      expect(admin.firestore().batch().commit).toBeCalled();
    });

    it("handles Excel files without expected headers", async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("EmptySheet");
      ws.addRow(["無関係なヘッダー1", "無関係なヘッダー2"]);
      ws.addRow(["値1", "値2"]);
      const invalidBuffer = await wb.xlsx.writeBuffer();

      (axios.get as any) = jest.fn().mockImplementation((url) => {
        if (
          url ===
          "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
        ) {
          return Promise.resolve({ data: indexHtml });
        }
        return Promise.resolve({ data: invalidBuffer });
      });

      await createSettlementDict("test-settlement")();

      // No data should be committed
      expect(admin.firestore().batch().set).not.toBeCalled();
    });

    it("handles empty Excel workbook without worksheets", async () => {
      const wb = new ExcelJS.Workbook();
      const emptyBuffer = await wb.xlsx.writeBuffer();

      (axios.get as any) = jest.fn().mockImplementation((url) => {
        if (
          url ===
          "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
        ) {
          return Promise.resolve({ data: indexHtml });
        }
        return Promise.resolve({ data: emptyBuffer });
      });

      await createSettlementDict("test-settlement")();

      expect(admin.firestore().batch().set).not.toBeCalled();
    });
  });
});
