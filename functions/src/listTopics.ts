import axios from "axios";
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import logger from "./lib/logger";

export const listTopics = async (
  req: functions.Request,
  res: functions.Response
) => {
  const IID_TOKEN = req.body?.IID_TOKEN;
  logger.info("listTopics request received for IID_TOKEN", {
    hasToken: !!IID_TOKEN,
  });

  if (
    typeof IID_TOKEN !== "string" ||
    !/^[a-zA-Z0-9-_:]{1,256}$/.test(IID_TOKEN)
  ) {
    res.status(400).send("Invalid IID_TOKEN");
    return;
  }

  const url = `https://iid.googleapis.com/iid/info/${IID_TOKEN}?details=true`;

  const token = await admin.app().options.credential?.getAccessToken();

  if (!token) {
    res.status(500).send("token not found");
    return;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        access_token_auth: "true",
      },
      timeout: 15000,
    });

    logger.info("Retrieved topic subscriptions from IID API", {
      topicsCount: Object.keys(response.data?.rel?.topics || {}).length,
    });

    res.json(response.data.rel);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.status === 400) {
        res.json({});
        return;
      }
      logger.warn("Axios error in listTopics calling IID API:", {
        status: err.response?.status,
        data: err.response?.data,
      });
      res.status(err.response?.status || 500).send(err.response?.data);
      return;
    }
    logger.error("Unexpected error in listTopics:", err);
    res.status(500).send(err);
  }
};
