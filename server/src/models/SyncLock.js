const mongoose = require("mongoose");

const syncLockSchema = new mongoose.Schema(
  {
    lockKey: {
      type: String,
      required: true,
      trim: true,
    },

    ownerToken: {
      type: String,
      required: true,
    },

    acquiredAt: {
      type: Date,
      required: true,
    },

    heartbeatAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "sync_locks",
    versionKey: false,
  },
);

syncLockSchema.index(
  { lockKey: 1 },
  { unique: true, name: "unique_sync_lock_key" },
);

module.exports = mongoose.model("SyncLock", syncLockSchema);
