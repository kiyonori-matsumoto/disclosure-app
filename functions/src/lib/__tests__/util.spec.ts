import { zeroPad, notEmpty, chunk } from "../util";

describe("util", () => {
  describe("notEmpty", () => {
    it("should return false for null", () => {
      expect(notEmpty(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(notEmpty(undefined)).toBe(false);
    });

    it("should return true for empty string", () => {
      expect(notEmpty("")).toBe(true);
    });

    it("should return true for zero", () => {
      expect(notEmpty(0)).toBe(true);
    });

    it("should return true for false", () => {
      expect(notEmpty(false)).toBe(true);
    });

    it("should return true for objects", () => {
      expect(notEmpty({})).toBe(true);
    });

    it("should return true for arrays", () => {
      expect(notEmpty([])).toBe(true);
    });

    it("should act as a type guard", () => {
      const arr = [1, null, 2, undefined, 3];
      const filtered: number[] = arr.filter(notEmpty);
      expect(filtered).toEqual([1, 2, 3]);
    });
  });

  describe("zeroPad", () => {
    it("should pad zero to the start", () => {
      expect(zeroPad(5, 3)).toBe("005");
    });

    it("should pad to correct length", () => {
      expect(zeroPad(12, 4)).toBe("0012");
    });

    it("should not pad if length is enough", () => {
      expect(zeroPad(1234, 4)).toBe("1234");
    });
  });

  describe("chunk", () => {
    it("should split array into chunks", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("should handle empty array", () => {
      expect(chunk([], 2)).toEqual([]);
    });

    it("should handle chunk size larger than array", () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it("should return empty array for non-positive sizes to avoid infinite loops", () => {
      expect(chunk([1, 2, 3], 0)).toEqual([]);
      expect(chunk([1, 2, 3], -1)).toEqual([]);
    });
  });
});
