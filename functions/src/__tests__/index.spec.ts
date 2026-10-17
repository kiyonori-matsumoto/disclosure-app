import "jest";

// Use __mocks__/firebase-admin.ts
jest.mock("firebase-admin");

import * as indexModule from "../index";

describe("index exports", () => {
  it("should export all expected Cloud Functions (v1 and v2)", () => {
    // v2 Scheduled Functions
    expect(indexModule.checkNewDisclosure2).toBeDefined();
    expect(indexModule.checkNewEdinet).toBeDefined();
    expect(indexModule.createCompanyDict2).toBeDefined();
    expect(indexModule.createSettlementDict).toBeDefined();
    expect(indexModule.sendSettlementToTopic).toBeDefined();

    // v2 HTTPS Functions
    expect(indexModule.listTopics).toBeDefined();
    expect(indexModule.getDownloadUrlEdinet).toBeDefined();

    // v1 Event Triggers
    expect(indexModule.sendTopicFs2).toBeDefined();
    expect(indexModule.saveDocumentFs).toBeDefined();
    expect(indexModule.sendEdinetToTopic).toBeDefined();
    expect(indexModule.changeTopic).toBeDefined();
    expect(indexModule.handleContentViewEvent).toBeDefined();
  });
});
