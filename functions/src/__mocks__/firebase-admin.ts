import "jest";

const docFn = jest.fn(() => query);
const getFn = jest.fn();
const query: jest.Mock = jest.fn(() => ({
  doc: docFn,
  orderBy: query,
  where: query,
  limit: query,
  get: getFn
}));

const setFn = jest.fn();
const commitFn = jest.fn().mockReturnValue(true);

export const firestore = () => ({
  batch: jest.fn(() => ({
    set: setFn,
    commit: commitFn
  })),
  collection: query,
  settings: jest.fn()
});
