import "jest";
import * as admin from "firebase-admin";

// Mock firebase-functions before importing the module
jest.mock("firebase-functions/v1", () => ({
  config: () => ({
    edinet: {
      apikey: "test-api-key"
    }
  }),
  pubsub: {
    Message: jest.fn()
  }
}));

jest.mock("firebase-admin", () => {
    return {
        firestore: jest.fn(),
    };
});
// Need to add batch() to firestore mock
(admin.firestore as any).batch = jest.fn();

jest.mock("request-promise-native");

import * as rp from "request-promise-native";
import checkNewEdinet from "../checkNewEdinet";

describe("checkNewEdinet", () => {
  let firestoreMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firestore mock structure
    firestoreMock = {
        collection: jest.fn(),
        batch: jest.fn()
    };
    (admin.firestore as any).mockReturnValue(firestoreMock);
  });

  it("should fetch edinet data and save new documents", async () => {
    // Mock request-promise-native
    const mockEdinetResponse = {
      metadata: {
        title: "提出書類一覧及びメタデータ",
        parameter: {
          date: "2024-05-30",
          type: "2"
        },
        resultset: {
          count: 2
        },
        processDateTime: "2024-05-30 15:30:00",
        status: "200"
      },
      results: [
        {
            seqNumber: 1,
            docID: "doc1",
            edinetCode: "E00001",
            filerName: "Test Company 1",
            ordinanceCode: "010",
            formCode: "030000",
            docTypeCode: "120",
            submitDateTime: "2024-05-30 10:00:00",
            docDescription: "Annual Report",
            issuerEdinetCode: null,
            subjectEdinetCode: null,
            subsidiaryEdinetCode: null,
            pdfFlag: "1"
        },
        {
            seqNumber: 2,
            docID: "doc2",
            edinetCode: "E00002",
            filerName: "Test Company 2",
            ordinanceCode: "010",
            formCode: "030000",
            docTypeCode: "120",
            submitDateTime: "2024-05-30 11:00:00",
            docDescription: "Quarterly Report",
            issuerEdinetCode: null,
            subjectEdinetCode: null,
            subsidiaryEdinetCode: null,
            pdfFlag: "1"
        }
      ]
    };

    (rp.get as any) = jest.fn().mockResolvedValue(mockEdinetResponse);

    // Mock Firestore get for last processed document
    // Case: No previous documents (start from 0)
    const mockGet = jest.fn().mockResolvedValue({
      empty: true,
      docs: []
    });

    // Mock firestore chain
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere2 = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });

    // Mock doc() to return a mock document reference
    const mockDocRef = { id: "mockDocId" };
    const mockDoc = jest.fn().mockReturnValue(mockDocRef);

    firestoreMock.collection.mockReturnValue({
      where: mockWhere1,
      doc: mockDoc
    });

    const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
    };
    firestoreMock.batch.mockReturnValue(mockBatch);

    // Run the function
    const context = { timestamp: "2024-05-30T12:00:00.000Z" };
    await checkNewEdinet(undefined, context);

    // Verify rp.get was called
    expect(rp.get).toHaveBeenCalled();

    // Verify firestore save
    expect(firestoreMock.batch).toHaveBeenCalled();
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalled();
  });

    it("should filter out already processed documents", async () => {
    // Mock request-promise-native
    const mockEdinetResponse = {
      results: [
        {
            seqNumber: 10,
            docID: "doc10",
            edinetCode: "E00010",
            filerName: "Company 10",
            ordinanceCode: "010",
            formCode: "030000",
            docTypeCode: "120",
            submitDateTime: "2024-05-30 10:00:00",
            docDescription: "Report",
            issuerEdinetCode: null,
            subjectEdinetCode: null,
            subsidiaryEdinetCode: null,
            pdfFlag: "1"
        },
        {
            seqNumber: 11,
            docID: "doc11",
            edinetCode: "E00011",
            filerName: "Company 11",
            ordinanceCode: "010",
            formCode: "030000",
            docTypeCode: "120",
            submitDateTime: "2024-05-30 11:00:00",
            docDescription: "Report",
            issuerEdinetCode: null,
            subjectEdinetCode: null,
            subsidiaryEdinetCode: null,
            pdfFlag: "1"
        }
      ]
    };
    (rp.get as any) = jest.fn().mockResolvedValue(mockEdinetResponse);

    // Mock Firestore get for last processed document
    // Case: Last processed seqNumber is 10
    const mockGet = jest.fn().mockResolvedValue({
      empty: false,
      docs: [{
          data: () => ({ seqNumber: 10 })
      }]
    });

     // Mock firestore chain
    const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
    const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere2 = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2 });

    // Mock doc() to return a mock document reference
    const mockDocRef = { id: "mockDocId" };
    const mockDoc = jest.fn().mockReturnValue(mockDocRef);

    firestoreMock.collection.mockReturnValue({
      where: mockWhere1,
      doc: mockDoc
    });

    const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
    };
    firestoreMock.batch.mockReturnValue(mockBatch);

    // Run the function
    const context = { timestamp: "2024-05-30T12:00:00.000Z" };
    await checkNewEdinet(undefined, context);

    // Verify firestore save: only document with seqNumber 11 should be saved
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({ seqNumber: 11 })
    );
    expect(mockBatch.commit).toHaveBeenCalled();
  });
});
