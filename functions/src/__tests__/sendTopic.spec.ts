import "jest";
import * as admin from "firebase-admin";
import sendTopic from "../sendTopic";

jest.mock("firebase-admin", () => {
    return {
        messaging: jest.fn(),
    };
});

describe("sendTopic", () => {
    let messagingMock: any;

    beforeEach(() => {
        jest.clearAllMocks();
        messagingMock = {
            sendEach: jest.fn().mockResolvedValue({
                successCount: 3,
                failureCount: 0,
                responses: [{ success: true }, { success: true }, { success: true }],
            }),
        };
        (admin.messaging as any).mockReturnValue(messagingMock);
    });

    it("should send messages to topic", async () => {
        const mockData = {
            title: "Test Title",
            code: "1234",
            company: "Test Company",
            noSend: false,
            tags2: ["Tag1", "Tag2"]
        };
        const snapshot = {
            data: () => mockData
        } as any;
        const context = {} as any;

        await sendTopic(snapshot, context);

        expect(admin.messaging).toHaveBeenCalled();
        expect(admin.messaging().sendEach).toHaveBeenCalled();
        // 1 (main) + 2 (tags) = 3 messages
        const calls = (admin.messaging().sendEach as jest.Mock).mock.calls[0][0];
        expect(calls).toHaveLength(3);
    });

    it("should not send if noSend is true", async () => {
        const mockData = {
            title: "Test Title",
            code: "1234",
            company: "Test Company",
            noSend: true
        };
        const snapshot = {
            data: () => mockData
        } as any;
        const context = {} as any;

        await sendTopic(snapshot, context);

        expect(admin.messaging().sendEach).not.toHaveBeenCalled();
    });

    it("should return true if data is undefined", async () => {
        const snapshot = {
            data: () => undefined
        } as any;
        const context = {} as any;

        const result = await sendTopic(snapshot, context);
        expect(result).toBe(true);
        expect(admin.messaging().sendEach).not.toHaveBeenCalled();
    });

    it("should normalize alphanumeric stock codes to uppercase in topic and messages", async () => {
        const mockData = {
            title: "決算短信",
            code: "130a",
            company: "アルファ企業",
            noSend: false,
            tags2: ["決算"]
        };
        const snapshot = {
            data: () => mockData
        } as any;
        const context = {} as any;

        await sendTopic(snapshot, context);

        expect(admin.messaging().sendEach).toHaveBeenCalled();
        const calls = (admin.messaging().sendEach as jest.Mock).mock.calls[0][0];
        // 1 main + 1 tag
        expect(calls).toHaveLength(2);

        const mainMsg = calls[0];
        expect(mainMsg.topic).toBe("code_130A");
        expect(mainMsg.notification.title).toBe("新しい開示情報 アルファ企業(130A)");
        expect(mainMsg.data.code).toBe("130A");
        expect(mainMsg.android.notification.tag).toBe("code_130A");
    });
});
