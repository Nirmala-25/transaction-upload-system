const { db } = require("../database");

// GET /audit-logs
// Get upload and approval history.
const getAuditLogs = (req, res) => {
    try {
        const auditLogs = db.prepare(`
            SELECT *
            FROM AuditLog
            ORDER BY id DESC
        `).all();

        return res.json({
            success: true,
            auditLogs
        });

    } catch (error) {
        console.error("Audit log error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve audit logs"
        });
    }
};

module.exports = {
    getAuditLogs
};