const mongoose = require("mongoose");

const Admin = require("../models/Admin");
const AdminAudit = require("../models/AdminAudit");

const { getFirebaseAdminAuth } = require("../config/firebaseAdmin");

// ==========================================
// HELPERS
// ==========================================

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getValidatedUid = (value) => {
  if (typeof value !== "string") {
    throw createHttpError(400, "Firebase UID is required.");
  }

  const uid = value.trim();

  if (!uid || uid.length > 128 || /\s/.test(uid)) {
    throw createHttpError(400, "Invalid Firebase UID.");
  }

  return uid;
};

const getFirebaseUser = async (uid) => {
  try {
    const firebaseUser = await getFirebaseAdminAuth().getUser(uid);

    if (firebaseUser.disabled) {
      throw createHttpError(409, "This Firebase account is disabled.");
    }

    return firebaseUser;
  } catch (error) {
    if (error.status) throw error;

    if (error.code === "auth/user-not-found") {
      throw createHttpError(404, "Firebase user was not found.");
    }

    console.error("[Firebase User Lookup]", error.message);

    throw createHttpError(
      503,
      "Unable to verify the Firebase account right now.",
    );
  }
};

const createAuditEntry = async ({
  session,
  actor,
  action,
  targetUid,
  targetEmail,
  targetDisplayName,
}) => {
  await AdminAudit.create(
    [
      {
        actorFirebaseUid: actor.firebaseUid,
        actorEmail: actor.email,
        action,
        targetFirebaseUid: targetUid,
        targetEmail,
        targetDisplayName,
      },
    ],
    { session },
  );
};

const handleControllerError = (res, error, operation) => {
  console.error(`[${operation}]`, error.message);

  return res.status(error.status || 500).json({
    success: false,
    message:
      error.status && error.status < 500
        ? error.message
        : "Unable to complete the admin management operation.",
  });
};

// ==========================================
// 1. LIST ADMINS
// GET /api/admins
// ==========================================

const getAdmins = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 50),
    );

    const { status, role, q } = req.query;

    const filter = {};

    if (status) {
      if (!["ACTIVE", "REVOKED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter.",
        });
      }

      filter.status = status;
    }

    if (role) {
      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role filter.",
        });
      }

      filter.role = role;
    }

    if (q && String(q).trim()) {
      const escapedQuery = String(q)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const searchRegex = new RegExp(escapedQuery, "i");

      filter.$or = [
        { email: searchRegex },
        { displayName: searchRegex },
        { firebaseUid: searchRegex },
      ];
    }

    const [admins, total] = await Promise.all([
      Admin.find(filter)
        .select(
          "firebaseUid email displayName role status createdByFirebaseUid createdAt updatedAt revokedAt revokedByFirebaseUid lastLoginAt",
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Admin.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: admins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "Get Admins");
  }
};

// ==========================================
// 2. LOOKUP FIREBASE USER
// POST /api/admins/lookup
// ==========================================

const lookupFirebaseUser = async (req, res) => {
  try {
    const firebaseUid = getValidatedUid(req.body?.firebaseUid);

    const firebaseUser = await getFirebaseUser(firebaseUid);

    const existingAdmin = await Admin.findOne({ firebaseUid })
      .select("firebaseUid email displayName role status")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Firebase account verified.",
      data: {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || null,
        displayName: firebaseUser.displayName || null,
        photoURL: firebaseUser.photoURL || null,
        emailVerified: Boolean(firebaseUser.emailVerified),
        existingAdmin: existingAdmin
          ? {
              role: existingAdmin.role,
              status: existingAdmin.status,
            }
          : null,
        canGrantAdmin:
          !existingAdmin ||
          (existingAdmin.role === "ADMIN" &&
            existingAdmin.status === "REVOKED"),
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "Firebase User Lookup");
  }
};

// ==========================================
// 3. GRANT ADMIN ACCESS
// POST /api/admins
// ==========================================

const grantAdminAccess = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const firebaseUid = getValidatedUid(req.body?.firebaseUid);

    // Never accept role, email or status from the request body.
    const firebaseUser = await getFirebaseUser(firebaseUid);

    let grantedAdmin = null;
    let action = "ADMIN_GRANTED";

    await session.withTransaction(async () => {
      const existingAdmin = await Admin.findOne({ firebaseUid }).session(
        session,
      );

      if (existingAdmin) {
        if (existingAdmin.role === "SUPER_ADMIN") {
          throw createHttpError(
            409,
            "This account already has protected Super Admin access.",
          );
        }

        if (existingAdmin.status === "ACTIVE") {
          throw createHttpError(
            409,
            "This user already has active admin access.",
          );
        }

        // Restore a revoked ADMIN instead of creating a duplicate.
        existingAdmin.email = firebaseUser.email || null;
        existingAdmin.displayName = firebaseUser.displayName || null;
        existingAdmin.status = "ACTIVE";
        existingAdmin.revokedAt = null;
        existingAdmin.revokedByFirebaseUid = null;

        await existingAdmin.save({ session });

        grantedAdmin = existingAdmin;
        action = "ADMIN_RESTORED";
      } else {
        const [newAdmin] = await Admin.create(
          [
            {
              firebaseUid: firebaseUser.uid,
              email: firebaseUser.email || null,
              displayName: firebaseUser.displayName || null,
              role: "ADMIN",
              status: "ACTIVE",
              createdByFirebaseUid: req.admin.firebaseUid,
            },
          ],
          { session },
        );

        grantedAdmin = newAdmin;
      }

      await createAuditEntry({
        session,
        actor: req.admin,
        action,
        targetUid: firebaseUser.uid,
        targetEmail: firebaseUser.email || null,
        targetDisplayName: firebaseUser.displayName || null,
      });
    });

    return res.status(action === "ADMIN_GRANTED" ? 201 : 200).json({
      success: true,
      message:
        action === "ADMIN_GRANTED"
          ? "Admin access granted successfully."
          : "Admin access restored successfully.",
      data: {
        firebaseUid: grantedAdmin.firebaseUid,
        email: grantedAdmin.email,
        displayName: grantedAdmin.displayName,
        role: grantedAdmin.role,
        status: grantedAdmin.status,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An admin record already exists for this Firebase UID.",
      });
    }

    return handleControllerError(res, error, "Grant Admin Access");
  } finally {
    await session.endSession();
  }
};

// ==========================================
// 4. REVOKE ADMIN ACCESS
// PATCH /api/admins/:firebaseUid/revoke
// ==========================================

const revokeAdminAccess = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const targetUid = getValidatedUid(req.params.firebaseUid);

    if (targetUid === req.admin.firebaseUid) {
      throw createHttpError(
        409,
        "You cannot revoke your own Super Admin session.",
      );
    }

    let revokedAdmin = null;

    await session.withTransaction(async () => {
      const admin = await Admin.findOne({ firebaseUid: targetUid }).session(
        session,
      );

      if (!admin) {
        throw createHttpError(404, "Admin account was not found.");
      }

      if (admin.role === "SUPER_ADMIN") {
        throw createHttpError(
          403,
          "Super Admin access cannot be revoked through this portal.",
        );
      }

      if (admin.status === "REVOKED") {
        throw createHttpError(409, "This admin account is already revoked.");
      }

      admin.status = "REVOKED";
      admin.revokedAt = new Date();
      admin.revokedByFirebaseUid = req.admin.firebaseUid;

      await admin.save({ session });

      revokedAdmin = admin;

      await createAuditEntry({
        session,
        actor: req.admin,
        action: "ADMIN_REVOKED",
        targetUid: admin.firebaseUid,
        targetEmail: admin.email,
        targetDisplayName: admin.displayName,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Admin access revoked successfully.",
      data: {
        firebaseUid: revokedAdmin.firebaseUid,
        role: revokedAdmin.role,
        status: revokedAdmin.status,
        revokedAt: revokedAdmin.revokedAt,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "Revoke Admin Access");
  } finally {
    await session.endSession();
  }
};

// ==========================================
// 5. RESTORE ADMIN ACCESS
// PATCH /api/admins/:firebaseUid/restore
// ==========================================

const restoreAdminAccess = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const targetUid = getValidatedUid(req.params.firebaseUid);

    const firebaseUser = await getFirebaseUser(targetUid);

    let restoredAdmin = null;

    await session.withTransaction(async () => {
      const admin = await Admin.findOne({ firebaseUid: targetUid }).session(
        session,
      );

      if (!admin) {
        throw createHttpError(404, "Admin account was not found.");
      }

      if (admin.role === "SUPER_ADMIN") {
        throw createHttpError(
          403,
          "Super Admin accounts cannot be changed through this portal.",
        );
      }

      if (admin.status === "ACTIVE") {
        throw createHttpError(409, "This admin account is already active.");
      }

      admin.email = firebaseUser.email || null;
      admin.displayName = firebaseUser.displayName || null;
      admin.status = "ACTIVE";
      admin.revokedAt = null;
      admin.revokedByFirebaseUid = null;

      await admin.save({ session });

      restoredAdmin = admin;

      await createAuditEntry({
        session,
        actor: req.admin,
        action: "ADMIN_RESTORED",
        targetUid: admin.firebaseUid,
        targetEmail: admin.email,
        targetDisplayName: admin.displayName,
      });
    });

    return res.status(200).json({
      success: true,
      message: "Admin access restored successfully.",
      data: {
        firebaseUid: restoredAdmin.firebaseUid,
        email: restoredAdmin.email,
        role: restoredAdmin.role,
        status: restoredAdmin.status,
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "Restore Admin Access");
  } finally {
    await session.endSession();
  }
};

// ==========================================
// 6. ADMIN AUDIT LOGS
// GET /api/admins/audit-logs
// ==========================================

const getAdminAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 50),
    );

    const filter = {};

    if (req.query.targetUid) {
      filter.targetFirebaseUid = String(req.query.targetUid).trim();
    }

    if (req.query.action) {
      const allowedActions = [
        "ADMIN_GRANTED",
        "ADMIN_REVOKED",
        "ADMIN_RESTORED",
      ];

      if (!allowedActions.includes(req.query.action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid audit action filter.",
        });
      }

      filter.action = req.query.action;
    }

    const [logs, total] = await Promise.all([
      AdminAudit.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      AdminAudit.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleControllerError(res, error, "Get Admin Audit Logs");
  }
};

// ==========================================
// GET CURRENT ADMIN PROFILE
// GET /api/admins/me
// ==========================================

const getMyAdminProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      firebaseUid: req.admin.firebaseUid,
      email: req.admin.email,
      displayName: req.admin.displayName,
      role: req.admin.role,
      status: req.admin.status,
    },
  });
};

module.exports = {
  getAdmins,
  lookupFirebaseUser,
  grantAdminAccess,
  revokeAdminAccess,
  restoreAdminAccess,
  getAdminAuditLogs,
  getMyAdminProfile,
};
