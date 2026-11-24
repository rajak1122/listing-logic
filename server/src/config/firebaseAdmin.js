const { initializeApp, cert, getApps } = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

let firebaseAuth = null;

const getFirebaseAdminAuth = () => {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const missingVariables = [];

  if (!projectId) missingVariables.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missingVariables.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKey) missingVariables.push("FIREBASE_PRIVATE_KEY");

  if (missingVariables.length > 0) {
    const error = new Error(
      `Missing Firebase Admin configuration: ${missingVariables.join(", ")}`,
    );

    error.code = "FIREBASE_ADMIN_CONFIG_MISSING";
    throw error;
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });

  firebaseAuth = getAuth(app);

  return firebaseAuth;
};

module.exports = { getFirebaseAdminAuth };
