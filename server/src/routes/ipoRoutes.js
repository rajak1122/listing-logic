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

const {
  verifyFirebaseToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const { backfillClosedIpoScripCodes } = require("../services/ipoSyncService");

// ==========================================
// PUBLIC ROUTES
// ==========================================

router.get("/", getIpos);

router.get("/:id", getIpoById);

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================

router.post("/", verifyFirebaseToken, requireAdmin, createIpo);

router.put("/:id", verifyFirebaseToken, requireAdmin, updateIpo);

router.delete("/:id", verifyFirebaseToken, requireAdmin, deleteIpo);

router.post("/sync", verifyFirebaseToken, requireAdmin, syncActiveIpos);

router.post(
  "/backfill-listing-dates",
  verifyFirebaseToken,
  requireAdmin,
  backfillClosedIpoListingDatesController,
);

router.post(
  "/backfill-scrip-codes",
  verifyFirebaseToken,
  requireAdmin,
  async (req, res) => {
    try {
      const updatedCount = await backfillClosedIpoScripCodes();

      res.json({
        success: true,
        message: "Closed IPO Scrip Code backfill completed",
        updatedCount,
      });
    } catch (error) {
      console.error("[Scrip Code Backfill Route]", error.message);

      res.status(500).json({
        success: false,
        message: "Scrip Code backfill failed",
        error: error.message,
      });
    }
  },
);

module.exports = router;
