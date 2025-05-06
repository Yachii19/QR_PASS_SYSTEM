const express = require('express');
const router = express.Router();
const studentController = require('../controllers/StudentController');

router.post('/register', studentController.registerStudent);
router.post('/generate-qr', studentController.generateQR);

router.post('/register-parent', studentController.registerParent);
router.post('/generate-parent-qr', studentController.generateParentQR);
module.exports = router;