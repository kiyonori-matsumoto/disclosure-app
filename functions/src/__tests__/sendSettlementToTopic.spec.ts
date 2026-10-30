import "jest";
import sendSettlementToTopic from "../sendSettlementToTopic";
import logger from "../lib/logger";

const mockMessaging = {
  send: jest.fn(),
};

const mockWhere = jest.fn();
const mockCollection = jest.fn(() => ({
  where: mockWhere,
}));

const mockFirestore = {
  collection: mockCollection,
};

jest.mock("firebase-admin", () => ({
  messaging: jest.fn(() => mockMessaging),
  firestore: jest.fn(() => mockFirestore),
}));

jest.mock("../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("sendSettlementToTopic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send FCM notification with correct FCM v1 payload structure", async () => {
    const mockSettlements = [
      {
        data: () => ({
          code: "1234",
          name: "テスト企業",
          quote: "本決算",
        }),
      },
    ];

    mockWhere.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        docs: mockSettlements,
      }),
    });
    mockMessaging.send.mockResolvedValue("projects/test/messages/msg_1");

    const results = await sendSettlementToTopic();

    expect(results).toHaveLength(1);
    expect(mockCollection).toHaveBeenCalledWith("settlements");
    expect(mockWhere).toHaveBeenCalledWith("schedule", "==", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mockMessaging.send).toHaveBeenCalledTimes(1);

    const callArg = mockMessaging.send.mock.calls[0][0];

    // Topic must be code_${code}
    expect(callArg.topic).toBe("code_1234");

    // Top-level notification MUST only have title and body (NO tag, NO color for FCM v1)
    expect(callArg.notification).toEqual({
      title: "決算予定情報 テスト企業(1234)",
      body: "テスト企業の決算(本決算)は本日の予定です！",
    });
    expect(callArg.notification.tag).toBeUndefined();
    expect(callArg.notification.color).toBeUndefined();

    // Android payload MUST have tag and color inside android.notification
    expect(callArg.android).toEqual({
      notification: {
        title: "決算予定情報 テスト企業(1234)",
        body: "テスト企業の決算(本決算)は本日の予定です！",
        tag: "code_1234",
        color: "#006064",
      },
    });

    // Data payload
    expect(callArg.data).toEqual({
      code: "1234",
      company: "テスト企業",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    });

    expect(logger.info).toHaveBeenCalledWith(
      "FCM sendSettlementToTopic completed: 1 succeeded, 0 failed"
    );
  });

  it("should do nothing when there are no settlements scheduled for today", async () => {
    mockWhere.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        docs: [],
      }),
    });

    const results = await sendSettlementToTopic();

    expect(results).toHaveLength(0);
    expect(mockMessaging.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Sending 0 settlement notifications")
    );
    expect(logger.info).toHaveBeenCalledWith(
      "FCM sendSettlementToTopic completed: 0 succeeded, 0 failed"
    );
  });

  it("should handle partial send failures and log errors", async () => {
    const mockSettlements = [
      {
        data: () => ({
          code: "1234",
          name: "企業A",
          quote: "本決算",
        }),
      },
      {
        data: () => ({
          code: "5678",
          name: "企業B",
          quote: "第2四半期",
        }),
      },
    ];

    mockWhere.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        docs: mockSettlements,
      }),
    });

    const sendError = new Error("FCM server error");
    mockMessaging.send
      .mockResolvedValueOnce("msg_1")
      .mockRejectedValueOnce(sendError);

    const results = await sendSettlementToTopic();

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");

    expect(logger.error).toHaveBeenCalledWith(
      "FCM send failed for settlement code 5678:",
      sendError
    );
    expect(logger.info).toHaveBeenCalledWith(
      "FCM sendSettlementToTopic completed: 1 succeeded, 1 failed"
    );
  });
});
