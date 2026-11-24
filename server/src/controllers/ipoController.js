const Ipo = require("../models/Ipo");
const mongoose = require("mongoose");

const {
  runFullIpoSync,
  backfillClosedIpoListingDates,
} = require("../services/ipoSyncService");

const { calculateIpoScore } = require("../services/scoringEngine");
// @desc    Get all IPOs with calculated scores
// @route   GET /api/ipos
const getIpos = async (req, res) => {
  try {
    const ipos = await Ipo.find().sort({ createdAt: -1 });

    // Attach real-time scoring results to each IPO record
    const scoredIpos = ipos.map((ipo) => {
      const evaluation = calculateIpoScore(ipo.toObject());
      return {
        ...ipo.toObject(),
        evaluation,
      };
    });

    res
      .status(200)
      .json({ success: true, count: scoredIpos.length, data: scoredIpos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single IPO by ID with detailed evaluation
// @route   GET /api/ipos/:id
const getIpoById = async (req, res) => {
  try {
    const ipo = await Ipo.findById(req.params.id);
    if (!ipo) {
      return res.status(404).json({ success: false, message: "IPO not found" });
    }

    const evaluation = calculateIpoScore(ipo.toObject());

    res
      .status(200)
      .json({ success: true, data: { ...ipo.toObject(), evaluation } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new IPO entry
// @route   POST /api/ipos
const createIpo = async (req, res) => {
  try {
    const newIpo = await Ipo.create(req.body);
    const evaluation = calculateIpoScore(newIpo.toObject());

    res.status(201).json({
      success: true,
      message: "IPO created successfully",
      data: { ...newIpo.toObject(), evaluation },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update IPO parameters (e.g., Daily GMP or Subscriptions update)
// @route   PUT /api/ipos/:id
const updateIpo = async (req, res) => {
  try {
    const updatedIpo = await Ipo.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!updatedIpo) {
      return res.status(404).json({ success: false, message: "IPO not found" });
    }

    const evaluation = calculateIpoScore(updatedIpo.toObject());
    res.status(200).json({
      success: true,
      message: "IPO updated successfully",
      data: { ...updatedIpo.toObject(), evaluation },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete IPO
// @route   DELETE /api/ipos/:id
const deleteIpo = async (req, res) => {
  try {
    const ipo = await Ipo.findByIdAndDelete(req.params.id);
    if (!ipo) {
      return res.status(404).json({ success: false, message: "IPO not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "IPO removed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const syncActiveIpos = async (req, res) => {
  try {
    const result = await runFullIpoSync({
      trigger: "manual",
    });

    if (result.skipped) {
      return res.status(409).json({
        success: false,
        code: "SYNC_ALREADY_RUNNING",
        message:
          "An IPO synchronization is already running. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live IPO sync completed successfully!",
      count: result.activeSyncedCount,
      activeSyncedCount: result.activeSyncedCount,
      closedUpdatedCount: result.closedUpdatedCount,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("[Manual IPO Sync Error]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synchronize IPO data.",
    });
  }
};

const backfillClosedIpoListingDatesController = async (req, res) => {
  try {
    const updatedCount = await backfillClosedIpoListingDates();

    return res.status(200).json({
      success: true,
      message: "Closed IPO listing date backfill completed.",
      updatedCount,
    });
  } catch (error) {
    console.error("[Closed IPO Listing Date Backfill Error]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to backfill closed IPO listing dates.",
    });
  }
};

module.exports = {
  getIpos,
  getIpoById,
  createIpo,
  updateIpo,
  deleteIpo,
  syncActiveIpos,
  backfillClosedIpoListingDatesController,
};
