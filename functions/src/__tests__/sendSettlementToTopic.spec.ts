import "jest";
import * as admin from "firebase-admin";
import sendSettlementToTopic from "../sendSettlementToTopic";

jest.mock("firebase-admin", () => {
  return {
    messaging: jest.fn(),
    firestore: jest.fn(),
  };
});
jest.mock("../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe("sendSettlementToTopic", () => {
  let messagingMock: any;
  let firestoreMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    messagingMock = {
      send: jest.fn().mockResolvedValue({}),
    };
    (admin.messaging as any).mockReturnValue(messagingMock);

    const fakeSettlementDocs = {
      docs: [
        {
          data: () => ({
            name: "TestCompany",
            code: "5678",
            quote: "Q1",
          }),
        },
      ],
    };

    firestoreMock = {
      collection: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(fakeSettlementDocs),
        }),
      }),
    };
    (admin.firestore as any).mockReturnValue(firestoreMock);
  });

  it("should send properly mapped settlement notifications", async () => {
    await sendSettlementToTopic();

    expect(admin.messaging().send).toHaveBeenCalled();
    const calls = (admin.messaging().send as jest.Mock).mock.calls[0][0];
    expect(calls).toEqual({
      topic: "code_5678",
      notification: {
        body: "TestCompanyの決算(Q1)は本日の予定です！",
        title: "決算予定情報 TestCompany(5678)",
      },
      android: {
        notification: {
          tag: "code_5678",
          color: "#006064",
        },
      },
      data: {
        code: "5678",
        company: "TestCompany",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    });
  });
});
