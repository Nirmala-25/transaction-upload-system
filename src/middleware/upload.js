const multer = require("multer");
const path = require("path");

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 2 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {
        if (path.extname(file.originalname).toLowerCase() !== ".csv") {
            return callback(new Error("Only CSV files are allowed"));
        }

        callback(null, true);
    }
});

module.exports = upload;