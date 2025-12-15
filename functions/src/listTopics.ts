import axios from "axios";
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

export const listTopics = async (
  req: functions.Request,
  res: functions.Response
) => {
  const IID_TOKEN = req.body.IID_TOKEN;
  console.log("IID_TOKEN", IID_TOKEN);

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
    });

    console.log("response", response.data);

    res.json(response.data.rel);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.status === 400) {
        res.json({});
        return;
      }
      res.status(err.response?.status || 500).send(err.response?.data);
      return;
    }
    console.error(err);
    res.status(500).send(err);
  }
};
