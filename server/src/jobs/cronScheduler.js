const cron = require("node-cron");
const {
  syncActiveIposData,
  syncClosedIposData,
} = require("../services/ipoSyncService");

const initCronJobs = () => {
  cron.schedule(
    "*/30 9-18 * * 1-5",
    async () => {
      console.log("⏰ Executing scheduled IPO background sync...");

      await syncActiveIposData();
      await syncClosedIposData();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );
};

module.exports = { initCronJobs };
