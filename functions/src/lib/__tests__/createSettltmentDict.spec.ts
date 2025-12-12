import "jest";

import * as fs from "fs";

jest.mock("firebase-admin");
jest.mock("axios");

import * as admin from "firebase-admin";

import { createSettlementDict } from "../createSettlementDict";
import axios from "axios";

const indexHtml = fs.readFileSync(__dirname + "/res/index.html");
const kessan04 = fs.readFileSync(__dirname + "/res/kessan04_0607.xlsx"); // 2250data, 未定=91
const kessan05 = fs.readFileSync(__dirname + "/res/kessan05_0621.xlsx"); // 451data, 未定=8

describe("lib/createSettlementDict", () => {
  beforeEach(() => {
    (axios.get as any) = jest.fn().mockImplementation((url, option) => {
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
});
