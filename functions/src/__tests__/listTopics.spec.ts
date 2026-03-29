import "jest";
import axios from "axios";
import * as admin from "firebase-admin";
import { listTopics } from "../listTopics";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock("firebase-admin", () => {
  return {
    app: jest.fn().mockReturnValue({
      options: {
        credential: {
          getAccessToken: jest.fn().mockResolvedValue({ access_token: "fake-token" }),
        },
      },
    }),
  };
});

describe("listTopics", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        IID_TOKEN: "valid_token_123",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("should return topics for a valid token", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        rel: {
          topics: {
            topic1: { addDate: "2023-01-01" },
          },
        },
      },
    });

    await listTopics(req, res);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://iid.googleapis.com/iid/info/valid_token_123?details=true",
      expect.any(Object)
    );
    expect(res.json).toHaveBeenCalledWith({
      topic1: { addDate: "2023-01-01" },
    });
  });

  it("should handle axios error 400 by returning empty object", async () => {
    const error = {
      status: 400,
      isAxiosError: true,
    };
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue(error);

    await listTopics(req, res);

    expect(res.json).toHaveBeenCalledWith({});
  });

  it("should handle other axios errors by returning the error status", async () => {
    const error = {
      status: 404,
      response: {
        status: 404,
        data: "Not Found",
      },
      isAxiosError: true,
    };
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue(error);

    await listTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("Not Found");
  });

  it("should return 400 for an invalid token (non-alphanumeric)", async () => {
    req.body.IID_TOKEN = "invalid_token_!!!";

    await listTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid IID_TOKEN");
  });

  it("should return 400 for an invalid token (too long)", async () => {
    req.body.IID_TOKEN = "a".repeat(257);

    await listTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid IID_TOKEN");
  });

  it("should return 400 for an invalid token (not a string)", async () => {
    req.body.IID_TOKEN = 123;

    await listTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid IID_TOKEN");
  });
});
