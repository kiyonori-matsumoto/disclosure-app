import "jest";
import changeTopic from "../changeTopic";

const dbMock = {
  ref: jest.fn(),
};

const messagingMock = {
  subscribeToTopic: jest.fn(),
  unsubscribeFromTopic: jest.fn(),
};

jest.mock("firebase-admin", () => ({
  database: jest.fn(() => dbMock),
  messaging: jest.fn(() => messagingMock),
}));

describe("changeTopic", () => {
  let dbRefMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    dbRefMock = {
      once: jest.fn(),
    };
    dbMock.ref.mockReturnValue(dbRefMock);
    messagingMock.subscribeToTopic.mockResolvedValue("" as any);
    messagingMock.unsubscribeFromTopic.mockResolvedValue("" as any);
  });

  it("should return null if user token does not exist", async () => {
    dbRefMock.once.mockResolvedValue({
      val: () => null,
    });

    const change = {
      before: { val: () => ({ "1234": true }) },
      after: { val: () => ({ "1234": true, "5678": true }) },
    } as any;
    const context = {
      params: { userId: "user-123" },
    } as any;

    const result = await changeTopic(change, context);
    expect(result).toBeNull();
    expect(messagingMock.subscribeToTopic).not.toHaveBeenCalled();
    expect(messagingMock.unsubscribeFromTopic).not.toHaveBeenCalled();
  });

  it("should subscribe to added topics and unsubscribe from deleted topics", async () => {
    dbRefMock.once.mockResolvedValue({
      val: () => "mock-token-abc",
    });

    const change = {
      before: {
        val: () => ({ "1111": true, "2222": true }),
      },
      after: {
        val: () => ({ "2222": true, "3333": true }),
      },
    } as any;
    const context = {
      params: { userId: "user-123" },
    } as any;

    await changeTopic(change, context);

    expect(messagingMock.subscribeToTopic).toHaveBeenCalledTimes(1);
    expect(messagingMock.subscribeToTopic).toHaveBeenCalledWith("mock-token-abc", "3333");

    expect(messagingMock.unsubscribeFromTopic).toHaveBeenCalledTimes(1);
    expect(messagingMock.unsubscribeFromTopic).toHaveBeenCalledWith("mock-token-abc", "1111");
  });

  it("should handle null before or after snapshots safely", async () => {
    dbRefMock.once.mockResolvedValue({
      val: () => "mock-token-abc",
    });

    const change = {
      before: { val: () => null },
      after: { val: () => ({ "7777": true }) },
    } as any;
    const context = {
      params: { userId: "user-123" },
    } as any;

    await changeTopic(change, context);

    expect(messagingMock.subscribeToTopic).toHaveBeenCalledWith("mock-token-abc", "7777");
    expect(messagingMock.unsubscribeFromTopic).not.toHaveBeenCalled();
  });
});
