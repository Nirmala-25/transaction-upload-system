const express = require("express");
const upload = require("../middleware/upload");

const {
    uploadTransactions
} = require("../controllers/uploadController");

const router = express.Router();

router.post(
    "/",
    upload.single("file"),
    uploadTransactions
);

module.exports = router;