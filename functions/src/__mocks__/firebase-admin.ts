import "jest";

const docFn = jest.fn(() => query);
const query: jest.Mock = jest.fn(() => ({
  doc: docFn
}));

const setFn = jest.fn();
const commitFn = jest.fn().mockReturnValue(true);

export const firestore = () => ({
  batch: jest.fn(() => ({
    set: setFn,
    commit: commitFn
  })),
  collection: query
});
