import "jest";

const docFn = jest.fn(() => query);
const getFn = jest.fn();
const query: jest.Mock = jest.fn(() => ({
  doc: docFn,
  orderBy: query,
  where: query,
  limit: query,
  get: getFn,
}));

const setFn = jest.fn();
const commitFn = jest.fn().mockReturnValue(true);

export const initializeApp = jest.fn();

export const firestore = () => ({
  batch: jest.fn(() => ({
    set: setFn,
    commit: commitFn,
  })),
  collection: query,
  settings: jest.fn(),
});

export const storage = jest.fn(() => ({
  bucket: jest.fn(() => ({
    file: jest.fn(() => ({
      save: jest.fn().mockResolvedValue(true),
      createWriteStream: jest.fn(),
    })),
  })),
}));

export const messaging = jest.fn(() => ({
  sendEach: jest.fn().mockResolvedValue({ successCount: 0, failureCount: 0, responses: [] }),
  subscribeToTopic: jest.fn().mockResolvedValue(true),
  unsubscribeFromTopic: jest.fn().mockResolvedValue(true),
}));

export const database = jest.fn(() => ({
  ref: jest.fn(() => ({
    once: jest.fn().mockResolvedValue({ val: () => null }),
  })),
}));
