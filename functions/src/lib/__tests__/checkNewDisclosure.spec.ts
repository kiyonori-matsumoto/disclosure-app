// tslint:disable-next-line:no-import-side-effect
import "jest";

import * as fs from "fs";
import * as path from "path";
import dayjs from "dayjs";

jest.mock("firebase-admin");
jest.mock("axios");

import axios from "axios";
import * as admin from "firebase-admin";

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
    (axios.get as any) = jest.fn().mockImplementation((url, _option) => {
      if (urlMocks[url] !== undefined) {
        return Promise.resolve({ data: urlMocks[url] });
      } else if (
        url === "https://www.release.tdnet.info/inbs/I_list_001_20171014.html"
      ) {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 404 }
        });
      } else if (
        url === "https://www.release.tdnet.info/inbs/I_list_001_20171013.html"
      ) {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 500 }
        });
      }
      return Promise.reject({
          isAxiosError: true,
          response: { status: 404 }
      });
    });
    (axios.isAxiosError as any) = jest.fn().mockReturnValue(true);
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
      { attributes: {} } as any,
      {
        timestamp: dayjs("2017-10-05T11:11:22").toISOString()
      } as any
    );
    expect(firestore.batch().set).toHaveBeenCalledTimes(129);
    expect(firestore.batch().set).toHaveBeenNthCalledWith(1, expect.anything(), {
      code: "6636",
      company: "Ｊ－ソルガムＪＨＤ   ",
      document: "140120171005486134",
      exchanges: "東",
      tags: { 業績予想: true }, // tagがつくこと
      tags2: ["業績予想"],
      time: 1507204500129, // 最後が129個目のドキュメントなので129になること
      title: "業績予想の修正並びに中期経営計画の取り下げに関するお知らせ",
      xbrl: "091220171005486134.zip"
    });
    expect(firestore.collection).toHaveBeenCalledWith("test-disclosures");
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
      { attributes: {} } as any,
      {
        timestamp: dayjs("2017-10-05T11:11:22").toISOString()
      } as any
    );
    expect(admin.firestore().batch().set).not.toHaveBeenCalled();
  });

  it("handles notfound error", async () => {
    getMock.mockResolvedValue({ docs: [] });
    console.log = jest.fn();
    await checkNewDisclosure("test-disclosures")(
      { attributes: {} } as any,
      {
        timestamp: dayjs("2017-10-14T11:11:22").toISOString()
      } as any
    );
    expect(admin.firestore().batch().set).not.toHaveBeenCalled();
    expect(admin.firestore().batch().commit).not.toHaveBeenCalled();
  });

  it("throws error other than notfound error", async () => {
    getMock.mockResolvedValue({ docs: [] });
    console.log = jest.fn();
    await expect(
      checkNewDisclosure("test-disclosures")(
        { attributes: {} } as any,
        {
          timestamp: dayjs("2017-10-13T11:11:22").toISOString()
        } as any
      )
    ).rejects.toHaveProperty("response.status", 500);
    expect(admin.firestore().batch().commit).not.toHaveBeenCalled();
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
      { attributes: {} } as any,
      {
        timestamp: dayjs("2018-05-11T12:00:00").toISOString()
      } as any
    );

    expect(admin.firestore().batch().set).toHaveBeenCalledTimes(1990);
    expect(admin.firestore().batch().commit).toHaveBeenCalledTimes(20);
  });

  it("extracts and uppercases alphanumeric stock code correctly from HTML", async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="kaijiSum">全1件</div>
          <table id="main-list-table">
            <tr>
              <td class="kjTime">15:00</td>
              <td class="kjCode"> 130a0 </td>
              <td class="kjName">アルファ新興株式会社</td>
              <td class="kjTitle"><a href="doc12345.pdf">新株発行に関するお知らせ</a></td>
              <td class="kjPlace">東</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    getMock.mockResolvedValue({ docs: [] });
    (axios.get as any) = jest.fn().mockImplementation((url) => {
      if (url.includes("I_list_001_")) {
        return Promise.resolve({ data: mockHtml });
      }
      return Promise.reject({
        isAxiosError: true,
        response: { status: 404 }
      });
    });

    await checkNewDisclosure("test-disclosures")(
      { attributes: {} } as any,
      {
        timestamp: dayjs("2024-05-11T12:00:00").toISOString()
      } as any
    );

    expect(admin.firestore().batch().set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        code: "130A",
        company: "アルファ新興株式会社",
        title: "新株発行に関するお知らせ",
        document: "doc12345",
      })
    );
  });
});
