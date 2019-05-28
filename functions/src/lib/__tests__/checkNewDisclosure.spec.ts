// tslint:disable-next-line:no-import-side-effect
import "jest";

import * as fs from "fs";
import * as path from "path";
import * as moment from "moment";

jest.mock("firebase-admin");
jest.mock("request-promise-native");

import * as rp from "request-promise-native";
import * as admin from "firebase-admin";

// tslint:disable-next-line:no-implicit-dependencies
const errors = require("request-promise-core/errors");

import { checkNewDisclosure } from "../checkNewDisclosure";

const FILEP = "res_checkNewDisclosure";

const urlMocks: { [key: string]: Buffer } = {};

const registerUrlMock = (file: string) => {
  urlMocks[`https://www.release.tdnet.info/inbs/${file}`] = fs.readFileSync(
    path.resolve(__dirname, `${FILEP}/${file}`)
  );
};

fs.readdirSync(path.resolve(__dirname, FILEP)).forEach(f => {
  registerUrlMock(path.basename(f));
});

describe("lib/checkNewDisclosure", () => {
  let getMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (rp.get as any) = jest.fn().mockImplementation((url, option) => {
      if (urlMocks[url] !== undefined) {
        return Promise.resolve(urlMocks[url]);
      } else if (
        url === "https://www.release.tdnet.info/inbs/I_list_001_20171014.html"
      ) {
        return Promise.reject(new errors.StatusCodeError(404, "not found"));
      } else if (
        url === "https://www.release.tdnet.info/inbs/I_list_001_20171013.html"
      ) {
        return Promise.reject(new errors.StatusCodeError(500, "server error"));
      }
      return Promise.reject("not found");
    });
    getMock = admin.firestore().collection("d").get as any;
  });
  it("can get html", async () => {
    const firestore = admin.firestore();
    getMock.mockResolvedValue({
      docs: [
        {
          data: () => {
            return {
              code: "62640",
              company: "M-マルマエ",
              title: "平成29年８月度 月次受注残高についてのお知らせ",
              document: "140120170909470727",
              exchanges: ["東"],
              time: 1504936800000
            };
          }
        }
      ]
    });

    console.log = jest.fn();

    await checkNewDisclosure("test-disclosures")(
      {} as any,
      {
        timestamp: moment("2017-10-05T11:11:22").toISOString()
      } as any
    );
    expect(firestore.batch().set).toBeCalledTimes(129);
    expect(firestore.batch().set).nthCalledWith(1, expect.anything(), {
      code: "6636",
      company: "Ｊ－ソルガムＪＨＤ   ",
      document: "140120171005486134",
      exchanges: "東",
      tags: { 業績予想: true }, // tagがつくこと
      time: 1507204500129, // 最後が129個目のドキュメントなので129になること
      title: "業績予想の修正並びに中期経営計画の取り下げに関するお知らせ"
    });
    expect(firestore.collection).toBeCalledWith("test-disclosures");
  });

  it("saves nothing when latest document is saved", async () => {
    getMock.mockResolvedValue({
      docs: [
        {
          data: () => {
            return {
              code: "6636",
              company: "M-マルマエ",
              title:
                "業績予想の修正並びに中期経営計画の取り下げに関するお知らせ",
              document: "140120171005486134",
              exchanges: ["東"],
              time: 1504936800000
            };
          }
        }
      ]
    });

    console.log = jest.fn();

    await checkNewDisclosure("test-disclosures")(
      {} as any,
      {
        timestamp: moment("2017-10-05T11:11:22").toISOString()
      } as any
    );
    expect(admin.firestore().batch().set).not.toBeCalled();
  });

  it("handles notfound error", async () => {
    getMock.mockResolvedValue({ docs: [] });
    console.log = jest.fn();
    await checkNewDisclosure("test-disclosures")(
      {} as any,
      {
        timestamp: moment("2017-10-14T11:11:22").toISOString()
      } as any
    );
    expect(admin.firestore().batch().set).not.toBeCalled();
    expect(admin.firestore().batch().commit).not.toBeCalled();
  });

  it("throws error other than notfound error", async () => {
    getMock.mockResolvedValue({ docs: [] });
    console.log = jest.fn();
    await expect(
      checkNewDisclosure("test-disclosures")(
        {} as any,
        {
          timestamp: moment("2017-10-13T11:11:22").toISOString()
        } as any
      )
    ).rejects.toHaveProperty("statusCode", 500);
    expect(admin.firestore().batch().commit).not.toBeCalled();
  });

  it("can get over 500 docs", async () => {
    getMock.mockResolvedValue({
      docs: [
        {
          data: () => {
            return {
              code: "17390",
              company: "Ｊ−ＳＥＥＤＨ",
              title: "（取消し）平成30年6月期の配当予想の修正に関するお知らせ",
              document: "",
              exchanges: ["東"],
              time: 1525995000000
            };
          }
        }
      ]
    });
    await checkNewDisclosure("test-disclosures")(
      {} as any,
      {
        timestamp: moment("2018-05-11T23:00:00").toISOString()
      } as any
    );

    expect(admin.firestore().batch().set).toBeCalledTimes(1990);
    expect(admin.firestore().batch().commit).toBeCalledTimes(20);
  });
});
