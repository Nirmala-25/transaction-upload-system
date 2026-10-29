const express = require("express");
const path = require("path");

const uploadRoutes = require("./routes/uploadRoutes");
const batchRoutes = require("./routes/batchRoutes");
const auditRoutes = require("./routes/auditRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON requests.
app.use(express.json());

// Serve frontend files from the public folder.
app.use(express.static(path.join(__dirname, "..", "public")));

// Register API routes.
app.use("/upload", uploadRoutes);
app.use("/batches", batchRoutes);
app.use("/audit-logs", auditRoutes);

// Handle upload and other request errors.
app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    // Handle Multer upload errors.
    if (error.name === "MulterError") {
        const statusCode = error.code === "LIMIT_FILE_SIZE"
            ? 413
            : 400;

        return res.status(statusCode).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "File size must not exceed 2 MB"
                : error.message
        });
    }

    // Invalid file extension.
    if (error.message === "Only CSV files are allowed") {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error("Server error:", error);

    return res.status(500).json({
        success: false,
        message: "An unexpected server error occurred"
    });
});

// Start the server.
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});


// const express = require("express");
// const multer = require("multer");
// const { parse } = require("csv-parse/sync");
// const path = require("path");

// const {
//     db,
//     insertBatch,
//     insertTransaction,
//     insertAuditLog
// } = require("./database");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Parse JSON requests.
// app.use(express.json());

// // Serve the frontend files from the public folder.
// app.use(express.static(path.join(__dirname, "..", "public")));

// // Configure CSV file uploads.
// const upload = multer({
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 2 * 1024 * 1024
//     },
//     fileFilter: (req, file, callback) => {
//         if (path.extname(file.originalname).toLowerCase() !== ".csv") {
//             return callback(new Error("Only CSV files are allowed"));
//         }

//         callback(null, true);
//     }
// });

// const REQUIRED_HEADERS = [
//     "transaction_id",
//     "customer_name",
//     "account_number",
//     "amount"
// ];

// // Check whether a transaction ID already exists in the database.
// const findTransaction = db.prepare(`
//     SELECT id
//     FROM "Transaction"
//     WHERE transaction_id = ?
// `);

// // --------------------------------------------------
// // API 1: POST /upload
// // Upload and validate a CSV file.
// // --------------------------------------------------

// app.post("/upload", upload.single("file"), (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please upload a CSV file"
//             });
//         }

//         const csvText = req.file.buffer.toString("utf8");

//         let rows;

//         try {
//             rows = parse(csvText, {
//                 bom: true,
//                 skip_empty_lines: true,
//                 trim: true,
//                 relax_column_count: false,
//                 skip_records_with_error: false
//             });
//         } catch (error) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid CSV format",
//                 error: error.message
//             });
//         }

//         if (rows.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "CSV file is empty"
//             });
//         }

//         // Check the CSV headers.
//         const headers = rows[0].map(header => header.trim());

//         const headersAreValid =
//             headers.length === REQUIRED_HEADERS.length &&
//             REQUIRED_HEADERS.every((header, index) => {
//                 return headers[index] === header;
//             });

//         if (!headersAreValid) {
//             return res.status(400).json({
//                 success: false,
//                 message: "CSV headers are incorrect",
//                 requiredHeaders: REQUIRED_HEADERS
//             });
//         }

//         if (rows.length === 1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "CSV contains no transaction records"
//             });
//         }

//         const dataRows = rows.slice(1);

//         const seenTransactionIds = new Set();
//         const validTransactions = [];
//         const errors = [];

//         // Validate every row.
//         dataRows.forEach((row, index) => {
//             const rowNumber = index + 2;

//             const transactionId = (row[0] || "").trim();
//             const customerName = (row[1] || "").trim();
//             const accountNumber = (row[2] || "").trim();
//             const amountText = (row[3] || "").trim();

//             const rowErrors = [];

//             // Mandatory field validation.
//             if (!transactionId) {
//                 rowErrors.push("Transaction ID is required");
//             }

//             if (!customerName) {
//                 rowErrors.push("Customer name is required");
//             }

//             if (!accountNumber) {
//                 rowErrors.push("Account number is required");
//             }

//             if (!amountText) {
//                 rowErrors.push("Amount is required");
//             }

//             // Duplicate detection within this CSV.
//             if (transactionId) {
//                 if (seenTransactionIds.has(transactionId)) {
//                     rowErrors.push("Duplicate transaction ID in CSV");
//                 } else {
//                     seenTransactionIds.add(transactionId);
//                 }

//                 // Duplicate detection against the database.
//                 if (findTransaction.get(transactionId)) {
//                     rowErrors.push(
//                         "Transaction ID already exists in database"
//                     );
//                 }
//             }

//             // Validate amount.
//             const amount = Number(amountText);

//             if (
//                 amountText !== "" &&
//                 (!Number.isFinite(amount) || amount <= 0)
//             ) {
//                 rowErrors.push(
//                     "Amount must be a valid number greater than zero"
//                 );
//             }

//             // Return errors for invalid rows.
//             if (rowErrors.length > 0) {
//                 errors.push({
//                     row: rowNumber,
//                     transactionId: transactionId || null,
//                     reasons: rowErrors
//                 });

//                 return;
//             }

//             // Keep valid records for database insertion.
//             validTransactions.push({
//                 transaction_id: transactionId,
//                 customer_name: customerName,
//                 account_number: accountNumber,
//                 amount
//             });
//         });

//         const totalRows = dataRows.length;
//         const validCount = validTransactions.length;
//         const invalidCount = errors.length;

//         // Create the batch and save valid transactions and audit
//         // log together in one database transaction.
//         const createBatch = db.transaction(() => {
//             const batchStatus = validCount > 0
//                 ? "PENDING"
//                 : "REJECTED";

//             const batchResult = insertBatch.run(
//                 req.file.originalname,
//                 totalRows,
//                 validCount,
//                 invalidCount,
//                 batchStatus
//             );

//             const batchId = Number(batchResult.lastInsertRowid);

//             validTransactions.forEach(transaction => {
//                 insertTransaction.run(
//                     batchId,
//                     transaction.transaction_id,
//                     transaction.customer_name,
//                     transaction.account_number,
//                     transaction.amount
//                 );
//             });

//             insertAuditLog.run(
//                 batchId,
//                 "UPLOAD",
//                 "Maker",
//                 `Uploaded ${req.file.originalname}. ` +
//                 `Valid: ${validCount}, Invalid: ${invalidCount}`
//             );

//             return batchId;
//         });

//         const batchId = createBatch();

//         return res.status(201).json({
//             success: true,
//             message: "CSV processed successfully",
//             batchId,
//             fileName: req.file.originalname,
//             totalRows,
//             validCount,
//             invalidCount,
//             status: validCount > 0 ? "PENDING" : "REJECTED",
//             errors
//         });

//     } catch (error) {
//         console.error("Upload error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to process CSV file"
//         });
//     }
// });

// // --------------------------------------------------
// // API 2: GET /batches
// // Get all uploaded batches.
// // --------------------------------------------------

// app.get("/batches", (req, res) => {
//     try {
//         const batches = db.prepare(`
//             SELECT
//                 id,
//                 file_name,
//                 total_rows,
//                 valid_count,
//                 invalid_count,
//                 status,
//                 created_at
//             FROM Batch
//             ORDER BY id DESC
//         `).all();

//         return res.json({
//             success: true,
//             batches
//         });

//     } catch (error) {
//         console.error("Get batches error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to retrieve batches"
//         });
//     }
// });

// // --------------------------------------------------
// // API 3: GET /batches/:id
// // Get one batch and its saved transactions.
// // --------------------------------------------------

// app.get("/batches/:id", (req, res) => {
//     try {
//         const batchId = Number(req.params.id);

//         if (!Number.isSafeInteger(batchId) || batchId <= 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid batch ID"
//             });
//         }

//         const batch = db.prepare(`
//             SELECT *
//             FROM Batch
//             WHERE id = ?
//         `).get(batchId);

//         if (!batch) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Batch not found"
//             });
//         }

//         const transactions = db.prepare(`
//             SELECT *
//             FROM "Transaction"
//             WHERE batch_id = ?
//             ORDER BY id
//         `).all(batchId);

//         return res.json({
//             success: true,
//             batch,
//             transactions
//         });

//     } catch (error) {
//         console.error("Get batch details error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to retrieve batch details"
//         });
//     }
// });

// // --------------------------------------------------
// // API 4: POST /batches/:id/approve
// // Approve a batch.
// // --------------------------------------------------

// app.post("/batches/:id/approve", (req, res) => {
//     try {
//         const batchId = Number(req.params.id);

//         if (!Number.isSafeInteger(batchId) || batchId <= 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid batch ID"
//             });
//         }

//         // All approval changes succeed together or roll back.
//         const approveBatch = db.transaction(() => {
//             const batch = db.prepare(`
//                 SELECT *
//                 FROM Batch
//                 WHERE id = ?
//             `).get(batchId);

//             if (!batch) {
//                 return {
//                     error: "Batch not found",
//                     statusCode: 404
//                 };
//             }

//             if (batch.status !== "PENDING") {
//                 return {
//                     error: "Only pending batches can be approved",
//                     statusCode: 409
//                 };
//             }

//             const result = db.prepare(`
//                 UPDATE "Transaction"
//                 SET status = 'AUTHORIZED'
//                 WHERE batch_id = ?
//                 AND status = 'PENDING'
//             `).run(batchId);

//             if (result.changes === 0) {
//                 return {
//                     error: "No pending transactions to approve",
//                     statusCode: 409
//                 };
//             }

//             db.prepare(`
//                 UPDATE Batch
//                 SET status = 'AUTHORIZED'
//                 WHERE id = ?
//             `).run(batchId);

//             insertAuditLog.run(
//                 batchId,
//                 "APPROVE",
//                 "Checker",
//                 `Authorized ${result.changes} transactions`
//             );

//             return {
//                 batchId,
//                 authorizedCount: result.changes
//             };
//         });

//         const result = approveBatch();

//         if (result.error) {
//             return res.status(result.statusCode).json({
//                 success: false,
//                 message: result.error
//             });
//         }

//         return res.json({
//             success: true,
//             message: "Batch approved successfully",
//             batchId: result.batchId,
//             authorizedCount: result.authorizedCount,
//             status: "AUTHORIZED"
//         });

//     } catch (error) {
//         console.error("Approval error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to approve batch"
//         });
//     }
// });

// // --------------------------------------------------
// // API 5: GET /audit-logs
// // Get upload and approval history.
// // --------------------------------------------------

// app.get("/audit-logs", (req, res) => {
//     try {
//         const auditLogs = db.prepare(`
//             SELECT *
//             FROM AuditLog
//             ORDER BY id DESC
//         `).all();

//         return res.json({
//             success: true,
//             auditLogs
//         });

//     } catch (error) {
//         console.error("Audit log error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to retrieve audit logs"
//         });
//     }
// });

// // Handle errors from file upload middleware.
// app.use((error, req, res, next) => {
//     if (res.headersSent) {
//         return next(error);
//     }

//     if (error instanceof multer.MulterError) {
//         const statusCode = error.code === "LIMIT_FILE_SIZE"
//             ? 413
//             : 400;

//         return res.status(statusCode).json({
//             success: false,
//             message: error.code === "LIMIT_FILE_SIZE"
//                 ? "File size must not exceed 2 MB"
//                 : error.message
//         });
//     }

//     return res.status(400).json({
//         success: false,
//         message: error.message || "Invalid request"
//     });
// });

// // Start the server.
// app.listen(PORT, () => {
//     console.log(`Server running at http://localhost:${PORT}`);
// });
