const express = require('express');
const multer = require('multer');
const path = require('path');
const fileController = require('../controllers/fileController');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, '..', 'storage', 'uploads');
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

router.post('/upload', upload.single('file'), fileController.uploadFile);
router.get('/', fileController.getUserFiles);
router.get('/:fileId/download', fileController.downloadFile);
router.delete('/:fileId', fileController.deleteFile);

module.exports = router;