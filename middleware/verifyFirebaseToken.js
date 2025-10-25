// middleware/verifyFirebaseToken.js
const admin = require("../firebaseAdmin");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized - No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).send({ error: "Invalid or expired token" });
  }
};

module.exports = { verifyFirebaseToken };