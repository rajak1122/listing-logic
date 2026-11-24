const { syncActiveIposData } = require("./activeSync");
const { syncClosedIposData } = require("./closedSync");
const {
  acquireSyncLock,
  renewSyncLock,
  releaseSyncLock,
} = require("../syncLockService");

const createFullSyncRunner = ({
  syncActive,
  syncClosed,
  acquireLock = null,
  renewLock = null,
  releaseLock = null,
  leaseMs = 10 * 60 * 1000,
  heartbeatMs = 60 * 1000,
}) => {
  // Local lock prevents duplicate calls inside this Node.js process.
  let localSyncInProgress = false;

  return async ({ trigger = "manual" } = {}) => {
    if (localSyncInProgress) {
      return {
        skipped: true,
        reason: "SYNC_ALREADY_RUNNING",
      };
    }

    localSyncInProgress = true;

    let distributedLock = null;
    let heartbeatTimer = null;
    let heartbeatInFlight = null;
    let lockLost = false;

    const startedAt = Date.now();

    try {
      // Acquire a shared MongoDB lease when configured.
      if (acquireLock) {
        distributedLock = await acquireLock({ leaseMs });

        if (!distributedLock) {
          console.warn(
            `[IPO Sync] Skipping ${trigger}: another server instance owns the lock.`,
          );

          return {
            skipped: true,
            reason: "SYNC_ALREADY_RUNNING",
          };
        }

        console.log(
          `[IPO Sync] Distributed lock acquired. Trigger: ${trigger}`,
        );

        // Renew lease while a potentially long sync is running.
        if (renewLock) {
          heartbeatTimer = setInterval(() => {
            if (heartbeatInFlight || lockLost) return;

            heartbeatInFlight = (async () => {
              const renewed = await renewLock(distributedLock, { leaseMs });

              if (!renewed) {
                lockLost = true;

                console.error(
                  "[IPO Sync] Distributed lock ownership was lost.",
                );
              }
            })()
              .catch((error) => {
                lockLost = true;

                console.error(
                  "[IPO Sync] Lock heartbeat failed:",
                  error.message,
                );
              })
              .finally(() => {
                heartbeatInFlight = null;
              });
          }, heartbeatMs);

          heartbeatTimer.unref?.();
        }
      }

      console.log(`[IPO Sync] Started. Trigger: ${trigger}`);

      const activeSyncedCount = await syncActive();

      if (lockLost) {
        throw new Error(
          "Distributed sync lock was lost. Stopping before closed IPO sync.",
        );
      }

      // Confirm ownership before starting the second phase.
      if (distributedLock && renewLock) {
        const renewed = await renewLock(distributedLock, { leaseMs });

        if (!renewed) {
          lockLost = true;

          throw new Error("Unable to confirm distributed sync lock ownership.");
        }
      }

      const closedUpdatedCount = await syncClosed();

      if (lockLost) {
        throw new Error(
          "Distributed sync lock was lost during closed IPO sync.",
        );
      }

      return {
        skipped: false,
        activeSyncedCount,
        closedUpdatedCount,
        durationMs: Date.now() - startedAt,
      };
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }

      // Do not release while a heartbeat update is still in flight.
      if (heartbeatInFlight) {
        await heartbeatInFlight;
      }

      if (distributedLock && releaseLock) {
        try {
          await releaseLock(distributedLock);
        } catch (error) {
          // The lease will expire if explicit release fails.
          console.error(
            "[IPO Sync] Lock release failed; it will expire automatically:",
            error.message,
          );
        }
      }

      localSyncInProgress = false;

      console.log(
        `[IPO Sync] Finished. Trigger: ${trigger}. Duration: ${Date.now() - startedAt}ms`,
      );
    }
  };
};

// Production sync runner uses the shared MongoDB lock.
const runFullIpoSync = createFullSyncRunner({
  syncActive: syncActiveIposData,
  syncClosed: syncClosedIposData,
  acquireLock: acquireSyncLock,
  renewLock: renewSyncLock,
  releaseLock: releaseSyncLock,
});

module.exports = { createFullSyncRunner, runFullIpoSync };
