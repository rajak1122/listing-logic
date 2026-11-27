const express = require("express");
const router = express.Router();

const {
  verifyFirebaseToken,
  requireAdmin,
  requireSuperAdmin,
} = require("../middleware/authMiddleware");

const {
  getAdmins,
  lookupFirebaseUser,
  grantAdminAccess,
  revokeAdminAccess,
  restoreAdminAccess,
  getAdminAuditLogs,
  getMyAdminProfile,
} = require("../controllers/adminController");
const {
  testBseSecuritySearch,
  testBseListingPrice,
} = require("../controllers/bseDiagnosticController");

// All management routes require a valid Firebase token.
router.use(verifyFirebaseToken);

// Both ADMIN and SUPER_ADMIN can access their own admin profile.
router.get("/me", requireAdmin, getMyAdminProfile);

// All remaining management routes require SUPER_ADMIN.
router.use(requireSuperAdmin);

// Temporary BSE outbound connectivity diagnostic.
router.get("/diagnostics/bse-security-search", testBseSecuritySearch);
router.get("/diagnostics/bse-listing-price", testBseListingPrice);

// List administrators.
router.get("/", getAdmins);

// Verify a Firebase UID before granting access.
router.post("/lookup", lookupFirebaseUser);

// Grant ADMIN role or restore a revoked ADMIN.
router.post("/", grantAdminAccess);

// Revoke an ADMIN account.
router.patch("/:firebaseUid/revoke", revokeAdminAccess);

// Restore a revoked ADMIN account.
router.patch("/:firebaseUid/restore", restoreAdminAccess);

// View permission history.
router.get("/audit-logs", getAdminAuditLogs);

module.exports = router;
