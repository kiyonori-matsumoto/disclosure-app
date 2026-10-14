import { zeroPad, notEmpty, chunk } from "../util";

describe("util", () => {
  describe("zeroPad", () => {
    it("should pad a number with zeros to the specified length", () => {
      expect(zeroPad(5, 3)).toBe("005");
      expect(zeroPad(42, 5)).toBe("00042");
    });

    it("should handle padding when the number length is equal to the target length", () => {
      expect(zeroPad(123, 3)).toBe("123");
    });

    it("should handle zero as input", () => {
      expect(zeroPad(0, 2)).toBe("00");
    });

    it("should truncate from the left if the number is larger than the target length", () => {
      expect(zeroPad(1234, 2)).toBe("34");
    });
  });

  describe("notEmpty", () => {
    it("should return true for defined values", () => {
      expect(notEmpty(1)).toBe(true);
      expect(notEmpty("test")).toBe(true);
      expect(notEmpty(true)).toBe(true);
      expect(notEmpty({})).toBe(true);
      expect(notEmpty([])).toBe(true);
      expect(notEmpty(0)).toBe(true);
      expect(notEmpty("")).toBe(true);
      expect(notEmpty(false)).toBe(true);
    });

    it("should return false for null and undefined", () => {
      expect(notEmpty(null)).toBe(false);
      expect(notEmpty(undefined)).toBe(false);
    });
  });

  describe("chunk", () => {
    it("should chunk an array into smaller arrays of the specified size", () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
    });

    it("should return a single chunk if the size is larger than the array length", () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it("should return an empty array if the input array is empty", () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it("should handle non-positive sizes by returning an empty array", () => {
      expect(chunk([1, 2, 3], 0)).toEqual([]);
      expect(chunk([1, 2, 3], -1)).toEqual([]);
    });
  });
});
