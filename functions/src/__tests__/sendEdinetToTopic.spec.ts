import "jest";
import * as admin from "firebase-admin";
import sendEdinetToTopic from "../sendEdinetToTopic";

jest.mock("firebase-admin", () => {
  return {
    messaging: jest.fn(),
    storage: jest.fn(),
  };
});
jest.mock("../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe("sendEdinetToTopic", () => {
  let messagingMock: any;
  let storageMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    messagingMock = {
      send: jest.fn().mockResolvedValue({}),
    };
    (admin.messaging as any).mockReturnValue(messagingMock);

    const fakeCompanies = [
      {
        edinetCode: "E00001",
        code: "12340",
        name: "TestCompany",
      },
    ];
    storageMock = {
      bucket: jest.fn().mockReturnValue({
        file: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue([Buffer.from(JSON.stringify(fakeCompanies))]),
        }),
      }),
    };
    (admin.storage as any).mockReturnValue(storageMock);
  });

  it("should send formatted message properly to topic", async () => {
    const mockData = {
      docDescription: "Sample doc",
      map: { E00001: true },
      noSend: false,
    };
    const snapshot = {
      data: () => mockData,
    } as any;

    await sendEdinetToTopic(snapshot, {} as any);

    expect(admin.messaging().send).toHaveBeenCalled();
    const calls = (admin.messaging().send as jest.Mock).mock.calls[0][0];
    expect(calls).toEqual({
      condition: "'code_1234' in topics && 'edinet_notification' in topics",
      notification: {
        body: "Sample doc",
        title: "新しいEdinet TestCompany(1234)",
      },
      android: {
        notification: {
          tag: "code_1234",
          color: "#006064",
        },
      },
      data: {
        title: "Sample doc",
        code: "1234",
        edinetCode: "E00001",
        company: "TestCompany",
        type: "edinet",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    });
  });

  it("should return true if noSend is true", async () => {
    const mockData = {
      docDescription: "Sample doc",
      map: { E00001: true },
      noSend: true,
    };
    const snapshot = {
      data: () => mockData,
    } as any;

    const res = await sendEdinetToTopic(snapshot, {} as any);
    expect(res).toBe(true);
    expect(admin.messaging().send).not.toHaveBeenCalled();
  });
});
