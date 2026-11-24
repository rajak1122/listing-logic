const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },

    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    displayName: {
      type: String,
      default: null,
      trim: true,
    },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN"],
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "REVOKED"],
      default: "ACTIVE",
      required: true,
    },

    createdByFirebaseUid: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedByFirebaseUid: {
      type: String,
      default: null,
      trim: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

adminSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model("Admin", adminSchema);
