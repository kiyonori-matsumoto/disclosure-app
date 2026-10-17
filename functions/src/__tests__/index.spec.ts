import "jest";

// Use __mocks__/firebase-admin.ts
jest.mock("firebase-admin");

import * as indexModule from "../index";

describe("index exports", () => {
  it("should export all expected Cloud Functions (v1 legacy and v2 Tokyo parallel)", () => {
    // v2 Scheduled Functions (Tokyo: asia-northeast1)
    expect(indexModule.checkNewDisclosure2).toBeDefined();
    expect(indexModule.checkNewEdinet).toBeDefined();
    expect(indexModule.createCompanyDict2).toBeDefined();
    expect(indexModule.createSettlementDict).toBeDefined();
    expect(indexModule.sendSettlementToTopic).toBeDefined();

    // v1 Legacy HTTPS Functions (US: us-central1 compatibility for existing apps)
    expect(indexModule.listTopics).toBeDefined();
    expect(indexModule.getDownloadUrlEdinet).toBeDefined();

    // v2 Tokyo HTTPS Functions (Tokyo: asia-northeast1 for new apps)
    expect(indexModule.listTopicsV2).toBeDefined();
    expect(indexModule.getDownloadUrlEdinetV2).toBeDefined();

    // v1 Event Triggers
    expect(indexModule.sendTopicFs2).toBeDefined();
    expect(indexModule.saveDocumentFs).toBeDefined();
    expect(indexModule.sendEdinetToTopic).toBeDefined();
    expect(indexModule.changeTopic).toBeDefined();
    expect(indexModule.handleContentViewEvent).toBeDefined();
  });
});
