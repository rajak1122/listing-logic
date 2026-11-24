const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load server/.env even when this script is executed separately.
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const Admin = require("../models/Admin");
const { getFirebaseAdminAuth } = require("../config/firebaseAdmin");

const bootstrapSuperAdmin = async () => {
  const firebaseUid = process.argv[2]?.trim();

  if (!firebaseUid || /\s/.test(firebaseUid)) {
    throw new Error(
      "Please provide a valid Firebase UID.\n" +
        "Usage: npm run bootstrap:superadmin -- YOUR_FIREBASE_UID",
    );
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  console.log("\n[Bootstrap] Verifying Firebase user...");

  // Verify the UID against Firebase Authentication.
  const firebaseAuth = getFirebaseAdminAuth();
  const firebaseUser = await firebaseAuth.getUser(firebaseUid);

  if (firebaseUser.disabled) {
    throw new Error("This Firebase account is disabled.");
  }

  console.log("[Bootstrap] Firebase user verified.");

  await mongoose.connect(process.env.MONGO_URI);

  console.log("[Bootstrap] MongoDB connected.");

  // This is an initial one-time bootstrap, not a recurring promotion tool.
  const existingSuperAdmin = await Admin.findOne({
    role: "SUPER_ADMIN",
  }).lean();

  if (existingSuperAdmin) {
    throw new Error(
      "A SUPER_ADMIN record already exists. " +
        "Initial bootstrap is allowed only once.",
    );
  }

  // Never automatically promote an existing ADMIN or REVOKED account.
  const existingUser = await Admin.findOne({
    firebaseUid,
  }).lean();

  if (existingUser) {
    throw new Error(
      "This Firebase user already has an admin record. " +
        "Review the existing record instead of creating another one.",
    );
  }

  const superAdmin = await Admin.create({
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email || null,
    displayName: firebaseUser.displayName || null,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    createdByFirebaseUid: firebaseUser.uid,
  });

  console.log("\n======================================");
  console.log(" SUPER ADMIN CREATED SUCCESSFULLY");
  console.log("======================================");
  console.log(`Name:   ${superAdmin.displayName || "Not provided"}`);
  console.log(`Email:  ${superAdmin.email || "Not provided"}`);
  console.log(`Role:   ${superAdmin.role}`);
  console.log(`Status: ${superAdmin.status}`);
  console.log("======================================\n");
};

bootstrapSuperAdmin()
  .catch((error) => {
    console.error("\n[Bootstrap Failed]", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
