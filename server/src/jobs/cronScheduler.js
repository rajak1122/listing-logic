const cron = require("node-cron");

const { runFullIpoSync } = require("../services/ipoSyncService");

// 09:00, 09:30 ... 17:00, 17:30, plus the final 18:00 run.
const CRON_SCHEDULES = ["0,30 9-17 * * 1-5", "0 18 * * 1-5"];

let scheduledTasks = [];

const runScheduledSync = async () => {
  console.log("[Cron] Scheduled IPO synchronization triggered.");

  try {
    const result = await runFullIpoSync({
      trigger: "scheduled",
    });

    if (result.skipped) {
      console.log("[Cron] Sync skipped because another instance is running.");

      return;
    }

    console.log("[Cron] Sync completed.", {
      activeSyncedCount: result.activeSyncedCount,
      closedUpdatedCount: result.closedUpdatedCount,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error(
      "[Cron] Scheduled IPO synchronization failed:",
      error.message,
    );
  }
};

const initCronJobs = () => {
  // Prevent duplicate cron registration within this process.
  if (scheduledTasks.length > 0) {
    return scheduledTasks;
  }

  scheduledTasks = CRON_SCHEDULES.map((expression) =>
    cron.schedule(expression, runScheduledSync, {
      timezone: "Asia/Kolkata",
    }),
  );

  console.log(
    "[Cron] IPO sync scheduled Monday-Friday, every 30 minutes, 09:00-18:00 IST.",
  );

  return scheduledTasks;
};

const stopCronJobs = () => {
  if (scheduledTasks.length === 0) return;

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks = [];

  console.log("[Cron] All scheduled jobs stopped.");
};

module.exports = {
  initCronJobs,
  stopCronJobs,
  CRON_SCHEDULES,
};
