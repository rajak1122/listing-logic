const express = require("express");
const router = express.Router();
const {
  getIpos,
  getIpoById,
  createIpo,
  updateIpo,
  deleteIpo,
  syncActiveIpos,
  backfillClosedIpoListingDatesController,
} = require("../controllers/ipoController");

const { backfillClosedIpoScripCodes } = require("../services/ipoSyncService");

router.route("/").get(getIpos).post(createIpo);

router.post("/sync", syncActiveIpos);

router.post("/backfill-listing-dates", backfillClosedIpoListingDatesController);

router.get("/backfill-scrip-codes", async (req, res) => {
  try {
    const updatedCount = await backfillClosedIpoScripCodes();

    res.json({
      message: "Closed IPO Scrip Code backfill completed",
      updatedCount,
    });
  } catch (error) {
    console.error("[Scrip Code Backfill Route] Error:", error.message);

    res.status(500).json({
      message: "Scrip Code backfill failed",
      error: error.message,
    });
  }
});

router.route("/:id").get(getIpoById).put(updateIpo).delete(deleteIpo);

module.exports = router;
