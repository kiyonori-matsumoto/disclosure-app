import "jest";
import sendEdinetToTopic from "../sendEdinetToTopic";
import logger from "../lib/logger";

const mockMessaging = {
  send: jest.fn(),
};

const mockStorageFile = {
  download: jest.fn(),
};

const mockStorageBucket = {
  file: jest.fn(() => mockStorageFile),
};

const mockStorage = {
  bucket: jest.fn(() => mockStorageBucket),
};

jest.mock("firebase-admin", () => ({
  messaging: jest.fn(() => mockMessaging),
  storage: jest.fn(() => mockStorage),
}));

jest.mock("../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("sendEdinetToTopic", () => {
  const companiesData = [
    { edinetCode: "E00001", code: "12340", name: "テスト株式会社" },
    { edinetCode: "E00002", code: "56780", name: "サンプル株式会社" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageFile.download.mockResolvedValue([
      Buffer.from(JSON.stringify(companiesData), "utf8"),
    ]);
    mockMessaging.send.mockResolvedValue("projects/test/messages/msg_id");
  });

  it("should send FCM notification with correct FCM v1 payload structure", async () => {
    const snapshot = {
      data: () => ({
        docDescription: "有価証券報告書",
        noSend: false,
        map: {
          E00001: true,
        },
      }),
    } as any;

    const results = await sendEdinetToTopic(snapshot);

    expect(results).toHaveLength(1);
    expect(mockMessaging.send).toHaveBeenCalledTimes(1);

    const callArg = mockMessaging.send.mock.calls[0][0];

    // Verify condition
    expect(callArg.condition).toBe("'code_1234' in topics && 'edinet_notification' in topics");

    // Top-level notification MUST only have title and body (NO tag, NO color for FCM v1)
    expect(callArg.notification).toEqual({
      title: "新しいEdinet テスト株式会社(1234)",
      body: "有価証券報告書",
    });
    expect(callArg.notification.tag).toBeUndefined();
    expect(callArg.notification.color).toBeUndefined();

    // Android payload MUST have tag and color inside android.notification
    expect(callArg.android).toEqual({
      notification: {
        title: "新しいEdinet テスト株式会社(1234)",
        body: "有価証券報告書",
        tag: "code_1234",
        color: "#006064",
      },
    });

    // Data payload
    expect(callArg.data).toEqual({
      title: "有価証券報告書",
      code: "1234",
      edinetCode: "E00001",
      company: "テスト株式会社",
      type: "edinet",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    });

    expect(logger.info).toHaveBeenCalledWith(
      "FCM sendEdinetToTopic completed: 1 succeeded, 0 failed"
    );
  });

  it("should return true and skip sending when noSend is true", async () => {
    const snapshot = {
      data: () => ({
        docDescription: "有価証券報告書",
        noSend: true,
        map: {
          E00001: true,
        },
      }),
    } as any;

    const result = await sendEdinetToTopic(snapshot);
    expect(result).toBe(true);
    expect(mockMessaging.send).not.toHaveBeenCalled();
  });

  it("should return true when data is undefined", async () => {
    const snapshot = {
      data: () => undefined,
    } as any;

    const result = await sendEdinetToTopic(snapshot);
    expect(result).toBe(true);
    expect(mockMessaging.send).not.toHaveBeenCalled();
  });

  it("should skip company if edinetCode is not found in companies dictionary", async () => {
    const snapshot = {
      data: () => ({
        docDescription: "有価証券報告書",
        noSend: false,
        map: {
          UNKNOWN_CODE: true,
        },
      }),
    } as any;

    const results = await sendEdinetToTopic(snapshot);
    expect(results).toHaveLength(0);
    expect(mockMessaging.send).not.toHaveBeenCalled();
  });

  it("should handle partial send failures and log errors", async () => {
    const snapshot = {
      data: () => ({
        docDescription: "四半期報告書",
        noSend: false,
        map: {
          E00001: true,
          E00002: true,
        },
      }),
    } as any;

    const sendError = new Error("FCM error");
    mockMessaging.send
      .mockResolvedValueOnce("msg_id_1")
      .mockRejectedValueOnce(sendError);

    const results = await sendEdinetToTopic(snapshot);

    expect(results).toHaveLength(2);
    expect(logger.error).toHaveBeenCalledWith(
      "FCM send failed for edinet message index 1:",
      sendError
    );
    expect(logger.info).toHaveBeenCalledWith(
      "FCM sendEdinetToTopic completed: 1 succeeded, 1 failed"
    );
  });
});
