import "jest";

import * as fs from "fs";

jest.mock("firebase-admin");
jest.mock("request-promise-native");

import * as rp from "request-promise-native";
import * as admin from "firebase-admin";

import { createSettlementDict } from "../createSettlementDict";

const indexHtml = fs.readFileSync(__dirname + "/res/index.html");
const kessan01 = fs.readFileSync(__dirname + "/res/kessan01_0301.xls"); // 177data, 未定=6
const kessan02 = fs.readFileSync(__dirname + "/res/kessan02_0315.xls"); // 389data, 未定=18
const kessan03 = fs.readFileSync(__dirname + "/res/kessan03_0315.xls"); // 2250data, 未定=91

describe("lib/createSettlementDict", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rp.get as any) = jest.fn().mockImplementation((url, option) => {
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html"
      ) {
        return Promise.resolve(indexHtml);
      }
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan01_0301.xls"
      ) {
        return Promise.resolve(kessan01);
      }
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan02_0315.xls"
      ) {
        return Promise.resolve(kessan02);
      }
      if (
        url ===
        "https://www.jpx.co.jp/listing/event-schedules/financial-announcement/tvdivq0000001ofb-att/kessan03_0315.xls"
      ) {
        return Promise.resolve(kessan03);
      }
      return Promise.reject("not found");
    });
  });

  it("can execute", async () => {
    await createSettlementDict("test-settlement")();
    expect(admin.firestore().batch().set).toBeCalledTimes(2701);
    expect(admin.firestore().collection("d").doc).toBeCalledTimes(2701);
    expect(admin.firestore().batch().set).nthCalledWith(
      1,
      expect.anything(),
      {
        code: "2198",
        schedule: "2019-03-01",
        name: "アイ・ケイ・ケイ",
        settlementDate: "10月31日",
        quote: "第１四半期"
      },
      { merge: true }
    );
    expect(admin.firestore().collection("d").doc).nthCalledWith(1, "2198");
    expect(admin.firestore().collection("d").doc).nthCalledWith(172, "3391");
    expect(admin.firestore().batch().set).nthCalledWith(
      172,
      expect.anything(),
      {
        code: "3391",
        schedule: "2019-03-18",
        name: "ツルハホールディングス",
        settlementDate: "5月15日",
        quote: "第３四半期"
      },
      { merge: true }
    );
    expect(admin.firestore().batch().commit).toBeCalledTimes(6);
  });
});
