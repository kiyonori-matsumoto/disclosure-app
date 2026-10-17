import "jest";
import addTag from "../addTag";

describe("addTag", () => {
  it("should extract matching tags and update doc", async () => {
    const updateMock = jest.fn().mockResolvedValue({ writeTime: {} });
    const mockDoc = {
      id: "doc-1",
      data: () => ({
        title: "2024年3月期 決算短信及び配当予想の修正に関するお知らせ",
      }),
      ref: {
        update: updateMock,
      },
    } as any;

    await addTag(mockDoc);

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      tags: {
        "決算": true,
        "配当": true,
        "短信": true,
      },
    });
  });

  it("should skip when doc data or title is missing", async () => {
    const updateMock = jest.fn();
    const mockDoc = {
      id: "doc-2",
      data: () => null,
      ref: {
        update: updateMock,
      },
    } as any;

    const result = await addTag(mockDoc);
    expect(result).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
