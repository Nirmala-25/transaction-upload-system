
# Transaction Import Tool

A simple CSV transaction import application built with Node.js,
Express.js, SQLite, HTML, CSS, and JavaScript.

## Features

- Upload CSV transaction files
- Validate mandatory fields
- Detect duplicate transaction IDs
- Validate positive transaction amounts
- Save valid transactions with PENDING status
- Display uploaded batches and transaction counts
- Approve pending batches
- Change transaction status to AUTHORIZED
- Maintain upload and approval audit logs

## Technologies

- Node.js
- Express.js
- SQLite
- better-sqlite3
- Multer
- csv-parse
- HTML, CSS, JavaScript

## Prerequisites

Install Node.js and npm.

## Installation

Clone the repository:

    git clone https://github.com/Nirmala-25/transaction-upload-system.git

Open the project folder:

    cd transaction-import-tool

Install dependencies:

    npm install

Start the application:

    npm start

For development:

    npm run dev

Open the application:

    http://localhost:3000

The SQLite database and tables are created automatically.

## CSV Format

The CSV file must have these headers in this order:

    transaction_id,customer_name,account_number,amount

See samples/sample-transactions.csv for an example.

## API Endpoints

| Method | Endpoint | Description |
| POST | /upload | Upload and validate CSV |
| GET | /batches | List uploaded batches |
| GET | /batches/:id | Get batch details |
| POST | /batches/:id/approve | Approve a pending batch |
| GET | /audit-logs | View audit history |

## Validation Rules

- All fields are mandatory.
- Transaction IDs must be unique within the file and database.
- Amount must be a valid number greater than zero.
- Invalid rows are returned with their row numbers and error reasons.
- Only valid transactions are stored.

## Approval Workflow

1. Maker uploads the CSV.
2. The system validates each record.
3. Valid transactions are saved as PENDING.
4. Checker approves the batch.
5. Transactions become AUTHORIZED.
6. The approval is recorded in AuditLog.

## Database Tables

- Batch
- Transaction
- AuditLog

## Limitations

This is a demonstration application. Maker and Checker identities
are labels rather than authenticated user accounts. Production use
would require authentication, authorization, and additional security
controls.
