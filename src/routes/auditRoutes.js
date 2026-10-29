const express = require("express");

const {
    getAuditLogs
} = require("../controllers/auditController");

const router = express.Router();

// GET /audit-logs
router.get("/", getAuditLogs);

module.exports = router;