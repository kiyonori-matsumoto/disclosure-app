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

    // v2 Firestore Triggers (US: us-central1 for nam5 database location)
    expect(indexModule.sendTopicFs2).toBeDefined();
    expect(indexModule.saveDocumentFs).toBeDefined();
    expect(indexModule.sendEdinetToTopic).toBeDefined();

    // v1 Analytics Trigger
    expect(indexModule.handleContentViewEvent).toBeDefined();
  });

  it("should configure us-central1 region for Firestore triggers", () => {
    const sendTopicFs2Endpoint = (indexModule.sendTopicFs2 as any).__endpoint;
    expect(sendTopicFs2Endpoint?.region).toContain("us-central1");

    const saveDocumentFsEndpoint = (indexModule.saveDocumentFs as any).__endpoint;
    expect(saveDocumentFsEndpoint?.region).toContain("us-central1");
    expect(saveDocumentFsEndpoint?.maxInstances).toBe(10);

    const sendEdinetToTopicEndpoint = (indexModule.sendEdinetToTopic as any).__endpoint;
    expect(sendEdinetToTopicEndpoint?.region).toContain("us-central1");
  });

  it("should configure EDINET_API_KEY secret for EDINET functions", () => {
    const checkNewEdinetEndpoint = (indexModule.checkNewEdinet as any).__endpoint;
    expect(checkNewEdinetEndpoint?.secretEnvironmentVariables).toEqual(
      expect.arrayContaining([{ key: "EDINET_API_KEY" }])
    );

    const getDownloadUrlEdinetV2Endpoint = (indexModule.getDownloadUrlEdinetV2 as any).__endpoint;
    expect(getDownloadUrlEdinetV2Endpoint?.secretEnvironmentVariables).toEqual(
      expect.arrayContaining([{ key: "EDINET_API_KEY" }])
    );
  });
});
