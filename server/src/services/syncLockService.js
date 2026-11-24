const { randomUUID } = require("crypto");
const SyncLock = require("../models/SyncLock");

const LOCK_KEY = "listinglogic-full-ipo-sync";

const DEFAULT_LEASE_MS = 10 * 60 * 1000;

// ==========================================
// ACQUIRE LOCK
// ==========================================

const acquireSyncLock = async ({ leaseMs = DEFAULT_LEASE_MS } = {}) => {
  // Ensure the unique lockKey index exists before acquisition.
  await SyncLock.init();

  const now = new Date();
  const ownerToken = randomUUID();

  try {
    const lock = await SyncLock.findOneAndUpdate(
      {
        lockKey: LOCK_KEY,
        expiresAt: { $lte: now },
      },
      {
        $set: {
          ownerToken,
          acquiredAt: now,
          heartbeatAt: now,
          expiresAt: new Date(now.getTime() + leaseMs),
        },

        $setOnInsert: {
          lockKey: LOCK_KEY,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    if (!lock || lock.ownerToken !== ownerToken) {
      return null;
    }

    console.log("[Sync Lock] Acquired.");

    return {
      lockKey: LOCK_KEY,
      ownerToken,
    };
  } catch (error) {
    // Another instance may have inserted the unique lockKey first.
    // That means the lock is currently held.
    if (error.code === 11000) {
      return null;
    }

    throw error;
  }
};

// ==========================================
// RENEW LEASE
// ==========================================

const renewSyncLock = async (lock, { leaseMs = DEFAULT_LEASE_MS } = {}) => {
  if (!lock?.lockKey || !lock?.ownerToken) {
    return false;
  }

  const now = new Date();

  const result = await SyncLock.updateOne(
    {
      lockKey: lock.lockKey,
      ownerToken: lock.ownerToken,
    },
    {
      $set: {
        heartbeatAt: now,
        expiresAt: new Date(now.getTime() + leaseMs),
      },
    },
  );

  return result.matchedCount === 1;
};

// ==========================================
// RELEASE LOCK
// ==========================================

const releaseSyncLock = async (lock) => {
  if (!lock?.lockKey || !lock?.ownerToken) {
    return;
  }

  // Only the owner can release its own lock.
  const result = await SyncLock.deleteOne({
    lockKey: lock.lockKey,
    ownerToken: lock.ownerToken,
  });

  if (result.deletedCount === 1) {
    console.log("[Sync Lock] Released.");
  }
};

module.exports = {
  acquireSyncLock,
  renewSyncLock,
  releaseSyncLock,
  DEFAULT_LEASE_MS,
};
