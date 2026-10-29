const express = require("express");

const {
    getBatches,
    getBatchById,
    approveBatch
} = require("../controllers/batchController");

const router = express.Router();

// GET /batches
router.get("/", getBatches);

// GET /batches/:id
router.get("/:id", getBatchById);

// POST /batches/:id/approve
router.post("/:id/approve", approveBatch);

module.exports = router;