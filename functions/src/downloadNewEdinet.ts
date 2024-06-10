import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as axios from "axios";

const DB_PATH = "edinets";

if (!process.env.FIREBASE_CONFIG) {
  throw new Error("FIREBASE_CONFIG is not set");
}

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);

const getDownloadUrlEdinet = async (
  req: functions.Request,
  res: functions.Response
) => {
  const myBucket = admin.storage().bucket(firebaseConfig.storageBucket);

  const { docId } = req.query;

  if (!docId) {
    res.status(400).send("docId is required");
    return;
  }

  const documentPath = `${DB_PATH}/${docId}.pdf`;

  const [exists] = await myBucket.file(documentPath).exists();
  if (!exists) {
    const url = `https://api.edinet-fsa.go.jp/api/v2/documents/${docId}?&type=2&Subscription-Key=${
      functions.config().edinet.apikey
    }`;

    // download and save to storage
    const response = await axios.default.get(url, { responseType: "stream" });

    if (response.headers["content-type"] !== "application/pdf") {
      res.status(404).send("not found");
      return;
    }

    const writer = myBucket.file(documentPath).createWriteStream();
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }
  const [signedUrl] = await myBucket.file(documentPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  res.json({ signedUrl });
};

export default getDownloadUrlEdinet;
