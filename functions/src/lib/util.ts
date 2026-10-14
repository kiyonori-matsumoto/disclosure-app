export const zeroPad = (n: number, len: number) => {
  return ("000000000" + n).slice(-len);
};

export const notEmpty = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};
