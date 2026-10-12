import "jest";

const mockUpdate = jest.fn();
const mockDocRef = {
  get: jest.fn(),
  update: mockUpdate,
};

const mockDocSnapshot = {
  exists: true,
  data: jest.fn().mockReturnValue({ view_count: 5, title: "Sample Disclosure" }),
  ref: mockDocRef,
  id: "sample_doc_id",
};

const mockQuerySnapshot = {
  empty: false,
  docs: [mockDocSnapshot],
};

const mockCollection = {
  doc: jest.fn().mockReturnValue(mockDocRef),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue(mockQuerySnapshot),
};

const mockFirestore = {
  collection: jest.fn().mockReturnValue(mockCollection),
};

const mockFieldValueIncrement = jest.fn((n) => ({ incrementBy: n }));

jest.mock("firebase-admin", () => ({
  firestore: Object.assign(
    jest.fn(() => mockFirestore),
    {
      FieldValue: {
        increment: (n: number) => mockFieldValueIncrement(n),
      },
    }
  ),
}));

import handleContentViewEvent from "../handleContentViewEvent";

describe("handleContentViewEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocSnapshot.exists = true;
    mockQuerySnapshot.empty = false;
    mockQuerySnapshot.docs = [mockDocSnapshot];
    mockDocRef.get.mockResolvedValue(mockDocSnapshot);
    mockCollection.get.mockResolvedValue(mockQuerySnapshot);
  });

  it("should return early when item_id is missing", async () => {
    const event = {
      params: { content_type: "edinet_pdf" },
    } as any;

    const result = await handleContentViewEvent(event);
    expect(result).toBe(true);
    expect(mockFirestore.collection).not.toHaveBeenCalled();
  });

  describe("edinet_pdf content_type", () => {
    it("should atomically increment view_count when document exists", async () => {
      const event = {
        params: { content_type: "edinet_pdf", item_id: "S100TEST" },
      } as any;

      const result = await handleContentViewEvent(event);
      expect(result).toBe(true);
      expect(mockFirestore.collection).toHaveBeenCalledWith("edinets");
      expect(mockCollection.doc).toHaveBeenCalledWith("S100TEST");
      expect(mockFieldValueIncrement).toHaveBeenCalledWith(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        view_count: { incrementBy: 1 },
      });
    });

    it("should handle non-existent edinet document without crashing", async () => {
      mockDocRef.get.mockResolvedValue({ exists: false });

      const event = {
        params: { content_type: "edinet_pdf", item_id: "NON_EXISTENT" },
      } as any;

      const result = await handleContentViewEvent(event);
      expect(result).toBe(true);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("disclosure content_type", () => {
    it("should atomically increment view_count when document exists", async () => {
      const event = {
        params: { content_type: "disclosure", item_id: "doc123" },
      } as any;

      const result = await handleContentViewEvent(event);
      expect(result).toBe(true);
      expect(mockFirestore.collection).toHaveBeenCalledWith("disclosures");
      expect(mockCollection.where).toHaveBeenCalledWith("document", "==", "doc123");
      expect(mockCollection.limit).toHaveBeenCalledWith(1);
      expect(mockFieldValueIncrement).toHaveBeenCalledWith(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        view_count: { incrementBy: 1 },
      });
    });

    it("should handle non-existent disclosure document without crashing (null-safe)", async () => {
      mockCollection.get.mockResolvedValue({ empty: true, docs: [] });

      const event = {
        params: { content_type: "disclosure", item_id: "NON_EXISTENT" },
      } as any;

      const result = await handleContentViewEvent(event);
      expect(result).toBe(true);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
