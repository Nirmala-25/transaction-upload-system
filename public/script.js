
const uploadForm = document.getElementById("uploadForm");
const csvFile = document.getElementById("csvFile");
const uploadButton = document.getElementById("uploadButton");
const uploadMessage = document.getElementById("uploadMessage");

const errorSection = document.getElementById("errorSection");
const errorResults = document.getElementById("errorResults");

const batchesTable = document.getElementById("batchesTable");
const auditTable = document.getElementById("auditTable");

const detailsSection = document.getElementById("detailsSection");
const detailsHeading = document.getElementById("detailsHeading");
const batchInfo = document.getElementById("batchInfo");
const transactionsTable = document.getElementById("transactionsTable");

// Escape text before inserting database values into HTML.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

// Display a status label.
function statusHTML(status) {
    const safeStatus = escapeHTML(status);

    return `<span class="status status-${safeStatus}">
        ${safeStatus}
    </span>`;
}

// Format timestamps for display.
function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value.replace(" ", "T") + "Z");

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString();
}

// Upload a CSV file.
uploadForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const file = csvFile.files[0];

    if (!file) {
        showMessage("Please select a CSV file", false);
        return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
        showMessage("Please select a CSV file", false);
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    uploadButton.disabled = true;
    uploadMessage.textContent = "Uploading and validating CSV...";
    uploadMessage.className = "";
    errorSection.hidden = true;

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Upload failed", false);
            return;
        }

        showMessage(
            `Batch #${result.batchId} created. ` +
            `Valid: ${result.validCount}, ` +
            `Invalid: ${result.invalidCount}`,
            true
        );

        displayValidationErrors(result.errors || []);

        uploadForm.reset();

        await loadBatches();
        await loadAuditLogs();

    } catch (error) {
        console.error(error);
        showMessage("Unable to connect to the server", false);
    } finally {
        uploadButton.disabled = false;
    }
});

function showMessage(message, success) {
    uploadMessage.textContent = message;
    uploadMessage.className = success
        ? "success-message"
        : "error-message";
}

// Display CSV validation errors.
function displayValidationErrors(errors) {
    if (errors.length === 0) {
        errorSection.hidden = true;
        errorResults.replaceChildren();
        return;
    }

    errorSection.hidden = false;

    errorResults.innerHTML = errors.map(error => `
        <div class="error-item">
            <strong>CSV row ${error.row}</strong>
            ${error.transactionId
                ? ` — Transaction ${escapeHTML(error.transactionId)}`
                : ""}
            <ul>
                ${error.reasons.map(reason =>
                    `<li>${escapeHTML(reason)}</li>`
                ).join("")}
            </ul>
        </div>
    `).join("");
}

// Load the batches table and dashboard statistics.
async function loadBatches() {
    try {
        const response = await fetch("/batches");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load batches");
        }

        const batches = result.batches;

        document.getElementById("totalBatches").textContent =
            batches.length;

        document.getElementById("totalTransactions").textContent =
            batches.reduce((sum, batch) =>
                sum + Number(batch.valid_count), 0);

        document.getElementById("pendingTransactions").textContent =
            batches
                .filter(batch => batch.status === "PENDING")
                .reduce((sum, batch) =>
                    sum + Number(batch.valid_count), 0);

        document.getElementById("authorizedTransactions").textContent =
            batches
                .filter(batch => batch.status === "AUTHORIZED")
                .reduce((sum, batch) =>
                    sum + Number(batch.valid_count), 0);

        if (batches.length === 0) {
            batchesTable.innerHTML = `
                <tr><td colspan="7">No batches uploaded yet</td></tr>
            `;
            return;
        }

        batchesTable.innerHTML = batches.map(batch => `
            <tr>
                <td>${batch.id}</td>
                <td>${escapeHTML(batch.file_name)}</td>
                <td>${batch.total_rows}</td>
                <td>${batch.valid_count}</td>
                <td>${batch.invalid_count}</td>
                <td>${statusHTML(batch.status)}</td>
                <td>
                    <div class="action-buttons">
                        <button
                            type="button"
                            data-action="view"
                            data-id="${batch.id}">
                            View
                        </button>

                        ${batch.status === "PENDING" ? `
                            <button
                                type="button"
                                class="approve-button"
                                data-action="approve"
                                data-id="${batch.id}">
                                Approve
                            </button>
                        ` : ""}
                    </div>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        console.error(error);
        batchesTable.innerHTML = `
            <tr><td colspan="7">Unable to load batches</td></tr>
        `;
    }
}

// Handle View and Approve buttons.
batchesTable.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const batchId = button.dataset.id;
    const action = button.dataset.action;

    if (action === "view") {
        await viewBatch(batchId);
    }

    if (action === "approve") {
        await approveBatch(batchId, button);
    }
});

// Get one batch and its transactions.
async function viewBatch(batchId) {
    try {
        const response = await fetch(`/batches/${batchId}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to load batch");
        }

        const batch = result.batch;

        detailsHeading.textContent = `Batch #${batch.id}`;

        batchInfo.textContent =
            `File: ${batch.file_name} | ` +
            `Status: ${batch.status} | ` +
            `Valid: ${batch.valid_count} | ` +
            `Invalid: ${batch.invalid_count}`;

        if (result.transactions.length === 0) {
            transactionsTable.innerHTML = `
                <tr>
                    <td colspan="5">No valid transactions in this batch</td>
                </tr>
            `;
        } else {
            transactionsTable.innerHTML =
                result.transactions.map(transaction => `
                    <tr>
                        <td>${escapeHTML(transaction.transaction_id)}</td>
                        <td>${escapeHTML(transaction.customer_name)}</td>
                        <td>${escapeHTML(transaction.account_number)}</td>
                        <td>${Number(transaction.amount).toFixed(2)}</td>
                        <td>${statusHTML(transaction.status)}</td>
                    </tr>
                `).join("");
        }

        detailsSection.hidden = false;
        detailsSection.scrollIntoView({ behavior: "smooth" });

    } catch (error) {
        alert(error.message);
    }
}

// Approve a pending batch.
async function approveBatch(batchId, button) {
    const confirmed = confirm(
        `Are you sure you want to approve batch #${batchId}?`
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
        const response = await fetch(
            `/batches/${batchId}/approve`,
            { method: "POST" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Approval failed");
        }

        alert(result.message);

        await loadBatches();
        await loadAuditLogs();

        if (!detailsSection.hidden) {
            await viewBatch(batchId);
        }

    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
    }
}

// Load the audit log table.
async function loadAuditLogs() {
    try {
        const response = await fetch("/audit-logs");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load audit logs");
        }

        if (result.auditLogs.length === 0) {
            auditTable.innerHTML = `
                <tr><td colspan="5">No audit logs yet</td></tr>
            `;
            return;
        }

        auditTable.innerHTML = result.auditLogs.map(log => `
            <tr>
                <td>${log.batch_id}</td>
                <td>${escapeHTML(log.action)}</td>
                <td>${escapeHTML(log.performed_by)}</td>
                <td>${escapeHTML(log.details)}</td>
                <td>${escapeHTML(formatDate(log.created_at))}</td>
            </tr>
        `).join("");

    } catch (error) {
        console.error(error);
        auditTable.innerHTML = `
            <tr><td colspan="5">Unable to load audit logs</td></tr>
        `;
    }
}

// Refresh buttons.
document.getElementById("refreshButton").addEventListener(
    "click", loadBatches
);

document.getElementById("auditRefreshButton").addEventListener(
    "click", loadAuditLogs
);

document.getElementById("closeDetailsButton").addEventListener(
    "click", () => {
        detailsSection.hidden = true;
    }
);

// Load data when the page opens.
loadBatches();
loadAuditLogs();
