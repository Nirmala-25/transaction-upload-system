
const Database = require("better-sqlite3");
const path = require("path");

// Create the database file in the project root folder.
const dbPath = path.join(__dirname, "..", "transaction.db");
const db = new Database(dbPath);

// Enable foreign key relationships.
db.pragma("foreign_keys = ON");

// Table 1: Batch
db.exec(`
    CREATE TABLE IF NOT EXISTS Batch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        total_rows INTEGER NOT NULL DEFAULT 0,
        valid_count INTEGER NOT NULL DEFAULT 0,
        invalid_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

// Table 2: Transaction
db.exec(`
    CREATE TABLE IF NOT EXISTS "Transaction" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        transaction_id TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (batch_id)
        REFERENCES Batch(id)
    )
`);

// Table 3: AuditLog
db.exec(`
    CREATE TABLE IF NOT EXISTS AuditLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (batch_id)
        REFERENCES Batch(id)
    )
`);

// Prepare commonly used database queries.
const insertBatch = db.prepare(`
    INSERT INTO Batch (
        file_name,
        total_rows,
        valid_count,
        invalid_count,
        status
    )
    VALUES (?, ?, ?, ?, ?)
`);

const insertTransaction = db.prepare(`
    INSERT INTO "Transaction" (
        batch_id,
        transaction_id,
        customer_name,
        account_number,
        amount,
        status
    )
    VALUES (?, ?, ?, ?, ?, 'PENDING')
`);

const insertAuditLog = db.prepare(`
    INSERT INTO AuditLog (
        batch_id,
        action,
        performed_by,
        details
    )
    VALUES (?, ?, ?, ?)
`);

module.exports = {
    db,
    insertBatch,
    insertTransaction,
    insertAuditLog
};
