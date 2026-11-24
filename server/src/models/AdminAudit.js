const mongoose = require("mongoose");

const adminAuditSchema = new mongoose.Schema(
  {
    actorFirebaseUid: {
      type: String,
      required: true,
      trim: true,
    },

    actorEmail: {
      type: String,
      default: null,
      trim: true,
    },

    action: {
      type: String,
      enum: ["ADMIN_GRANTED", "ADMIN_REVOKED", "ADMIN_RESTORED"],
      required: true,
    },

    targetFirebaseUid: {
      type: String,
      required: true,
      trim: true,
    },

    targetEmail: {
      type: String,
      default: null,
      trim: true,
    },

    targetDisplayName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.index({ targetFirebaseUid: 1, createdAt: -1 });

module.exports = mongoose.model("AdminAudit", adminAuditSchema);
