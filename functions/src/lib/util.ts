export const zeroPad = (n: number, len: number) => {
  return ("000000000" + n).slice(-len);
};

export const notEmpty = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};
