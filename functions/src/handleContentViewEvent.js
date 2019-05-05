const admin = require("firebase-admin");


const handleContentViewEvent = (event, context) => {
  const db = admin.firestore();

  if (event.params.content_type === 'edinet_pdf') {
    return null;
  } else {
    const DB_PATH = "disclosures";
    const document = event.params.item_id;
    console.log("document", document);

    const doc = db
      .collection(DB_PATH)
      .where("document", "==", document)
      .limit(1)
      .get();
    return doc.then(d => {
      const ref = d.docs[0].ref;
      const data = d.docs[0].data();
      const view_count = (data.view_count || 0) + 1;
      console.log("title:", data.title);
      console.log("id:", d.docs[0].id);
      console.log("set view_count", view_count);

      return ref.update({
        view_count
      });
    });
  }
};

module.exports = handleContentViewEvent;
