const {
    db,
    insertAuditLog
} = require("../database");

// GET /batches
// Get all uploaded batches.
const getBatches = (req, res) => {
    try {
        const batches = db.prepare(`
            SELECT
                id,
                file_name,
                total_rows,
                valid_count,
                invalid_count,
                status,
                created_at
            FROM Batch
            ORDER BY id DESC
        `).all();

        return res.json({
            success: true,
            batches
        });

    } catch (error) {
        console.error("Get batches error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve batches"
        });
    }
};

// GET /batches/:id
// Get one batch and its saved transactions.
const getBatchById = (req, res) => {
    try {
        const batchId = Number(req.params.id);

        if (!Number.isSafeInteger(batchId) || batchId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        const batch = db.prepare(`
            SELECT *
            FROM Batch
            WHERE id = ?
        `).get(batchId);

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Batch not found"
            });
        }

        const transactions = db.prepare(`
            SELECT *
            FROM "Transaction"
            WHERE batch_id = ?
            ORDER BY id
        `).all(batchId);

        return res.json({
            success: true,
            batch,
            transactions
        });

    } catch (error) {
        console.error("Get batch details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve batch details"
        });
    }
};

// POST /batches/:id/approve
// Approve a pending batch.
const approveBatch = (req, res) => {
    try {
        const batchId = Number(req.params.id);

        if (!Number.isSafeInteger(batchId) || batchId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        // All approval changes succeed together or roll back.
        const approveBatchTransaction = db.transaction(() => {
            const batch = db.prepare(`
                SELECT *
                FROM Batch
                WHERE id = ?
            `).get(batchId);

            if (!batch) {
                return {
                    error: "Batch not found",
                    statusCode: 404
                };
            }

            if (batch.status !== "PENDING") {
                return {
                    error: "Only pending batches can be approved",
                    statusCode: 409
                };
            }

            const result = db.prepare(`
                UPDATE "Transaction"
                SET status = 'AUTHORIZED'
                WHERE batch_id = ?
                AND status = 'PENDING'
            `).run(batchId);

            if (result.changes === 0) {
                return {
                    error: "No pending transactions to approve",
                    statusCode: 409
                };
            }

            db.prepare(`
                UPDATE Batch
                SET status = 'AUTHORIZED'
                WHERE id = ?
            `).run(batchId);

            insertAuditLog.run(
                batchId,
                "APPROVE",
                "Checker",
                `Authorized ${result.changes} transactions`
            );

            return {
                batchId,
                authorizedCount: result.changes
            };
        });

        const result = approveBatchTransaction();

        if (result.error) {
            return res.status(result.statusCode).json({
                success: false,
                message: result.error
            });
        }

        return res.json({
            success: true,
            message: "Batch approved successfully",
            batchId: result.batchId,
            authorizedCount: result.authorizedCount,
            status: "AUTHORIZED"
        });

    } catch (error) {
        console.error("Approval error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve batch"
        });
    }
};

module.exports = {
    getBatches,
    getBatchById,
    approveBatch
};