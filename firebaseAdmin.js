const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // ঠিক path দিস

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).send("Forbidden");
  }
};
module.exports = admin;
