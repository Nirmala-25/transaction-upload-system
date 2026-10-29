const { parse } = require("csv-parse/sync");

const {
    db,
    insertBatch,
    insertTransaction,
    insertAuditLog
} = require("../database");

const REQUIRED_HEADERS = [
    "transaction_id",
    "customer_name",
    "account_number",
    "amount"
];

// Check whether a transaction ID already exists in the database.
const findTransaction = db.prepare(`
    SELECT id
    FROM "Transaction"
    WHERE transaction_id = ?
`);

// POST /upload
// Upload and validate a CSV file.
const uploadTransactions = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a CSV file"
            });
        }

        const csvText = req.file.buffer.toString("utf8");

        let rows;

        try {
            rows = parse(csvText, {
                bom: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: false,
                skip_records_with_error: false
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: "Invalid CSV format",
                error: error.message
            });
        }

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "CSV file is empty"
            });
        }

        // Check the CSV headers.
        const headers = rows[0].map(header => header.trim());

        const headersAreValid =
            headers.length === REQUIRED_HEADERS.length &&
            REQUIRED_HEADERS.every((header, index) => {
                return headers[index] === header;
            });

        if (!headersAreValid) {
            return res.status(400).json({
                success: false,
                message: "CSV headers are incorrect",
                requiredHeaders: REQUIRED_HEADERS
            });
        }

        if (rows.length === 1) {
            return res.status(400).json({
                success: false,
                message: "CSV contains no transaction records"
            });
        }

        const dataRows = rows.slice(1);

        const seenTransactionIds = new Set();
        const validTransactions = [];
        const errors = [];

        // Validate every row.
        dataRows.forEach((row, index) => {
            const rowNumber = index + 2;

            const transactionId = (row[0] || "").trim();
            const customerName = (row[1] || "").trim();
            const accountNumber = (row[2] || "").trim();
            const amountText = (row[3] || "").trim();

            const rowErrors = [];

            // Mandatory field validation.
            if (!transactionId) {
                rowErrors.push("Transaction ID is required");
            }

            if (!customerName) {
                rowErrors.push("Customer name is required");
            }

            if (!accountNumber) {
                rowErrors.push("Account number is required");
            }

            if (!amountText) {
                rowErrors.push("Amount is required");
            }

            // Check duplicates within the current CSV.
            if (transactionId) {
                if (seenTransactionIds.has(transactionId)) {
                    rowErrors.push("Duplicate transaction ID in CSV");
                } else {
                    seenTransactionIds.add(transactionId);
                }

                // Check duplicates in previously saved transactions.
                if (findTransaction.get(transactionId)) {
                    rowErrors.push(
                        "Transaction ID already exists in database"
                    );
                }
            }

            // Validate amount.
            const amount = Number(amountText);

            if (
                amountText !== "" &&
                (!Number.isFinite(amount) || amount <= 0)
            ) {
                rowErrors.push(
                    "Amount must be a valid number greater than zero"
                );
            }

            // Store errors for invalid rows.
            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNumber,
                    transactionId: transactionId || null,
                    reasons: rowErrors
                });

                return;
            }

            // Store valid records for database insertion.
            validTransactions.push({
                transaction_id: transactionId,
                customer_name: customerName,
                account_number: accountNumber,
                amount
            });
        });

        const totalRows = dataRows.length;
        const validCount = validTransactions.length;
        const invalidCount = errors.length;

        // Save the batch, valid transactions and audit log together.
        const createBatch = db.transaction(() => {
            const batchStatus = validCount > 0
                ? "PENDING"
                : "REJECTED";

            const batchResult = insertBatch.run(
                req.file.originalname,
                totalRows,
                validCount,
                invalidCount,
                batchStatus
            );

            const batchId = Number(batchResult.lastInsertRowid);

            validTransactions.forEach(transaction => {
                insertTransaction.run(
                    batchId,
                    transaction.transaction_id,
                    transaction.customer_name,
                    transaction.account_number,
                    transaction.amount
                );
            });

            insertAuditLog.run(
                batchId,
                "UPLOAD",
                "Maker",
                `Uploaded ${req.file.originalname}. ` +
                `Valid: ${validCount}, Invalid: ${invalidCount}`
            );

            return batchId;
        });

        const batchId = createBatch();

        return res.status(201).json({
            success: true,
            message: "CSV processed successfully",
            batchId,
            fileName: req.file.originalname,
            totalRows,
            validCount,
            invalidCount,
            status: validCount > 0 ? "PENDING" : "REJECTED",
            errors
        });

    } catch (error) {
        console.error("Upload error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process CSV file"
        });
    }
};

module.exports = {
    uploadTransactions
};