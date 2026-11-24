const { getFirebaseAdminAuth } = require("../config/firebaseAdmin");
const Admin = require("../models/Admin");

// ==========================================
// 1. FIREBASE TOKEN VERIFICATION
// ==========================================

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization || "";

  const [scheme, ...tokenParts] = authorization.split(" ");
  const idToken = tokenParts.join(" ").trim();

  if (scheme !== "Bearer" || !idToken) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  let firebaseAuth;

  try {
    firebaseAuth = getFirebaseAdminAuth();
  } catch (error) {
    console.error("[Firebase Admin Initialization]", error.message);

    return res.status(503).json({
      success: false,
      message: "Authentication service is unavailable.",
    });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken, true);

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };

    next();
  } catch (error) {
    console.warn("[Firebase Token Verification]", error.code || error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};

// ==========================================
// 2. DATABASE-BASED ROLE AUTHORIZATION
// ==========================================

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    const firebaseUid = req.firebaseUser?.uid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Verified authentication is required.",
      });
    }

    try {
      // Always check MongoDB so revoked access takes effect
      // without waiting for a Firebase token to expire.
      const admin = await Admin.findOne({
        firebaseUid,
        status: "ACTIVE",
      })
        .select("firebaseUid email displayName role status")
        .lean();

      if (!admin) {
        return res.status(403).json({
          success: false,
          message: "Your account does not have active admin access.",
          code: "ADMIN_ACCESS_DENIED",
        });
      }

      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
          code: "INSUFFICIENT_ROLE",
        });
      }

      // Make the verified database admin record available
      // to controllers and subsequent middleware.
      req.admin = admin;

      next();
    } catch (error) {
      console.error("[Admin Authorization Error]", error.message);

      return res.status(503).json({
        success: false,
        message: "Unable to verify administrator permissions.",
      });
    }
  };
};

// ==========================================
// 3. ROLE MIDDLEWARE
// ==========================================

// Both ADMIN and SUPER_ADMIN can perform IPO operations.
const requireAdmin = authorizeRoles("ADMIN", "SUPER_ADMIN");

// Only SUPER_ADMIN can manage administrator accounts.
const requireSuperAdmin = authorizeRoles("SUPER_ADMIN");

module.exports = {
  verifyFirebaseToken,
  requireAdmin,
  requireSuperAdmin,
};
