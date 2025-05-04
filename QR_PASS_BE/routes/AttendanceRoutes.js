const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/AttendanceController');
const { verifyAdmin } = require('../middlewares/auth');

router.post('/verify-qr', attendanceController.verifyQR);
router.post('/decrypt-qr', attendanceController.decryptQR);
router.get('/', verifyAdmin, attendanceController.getAttendances);

module.exports = router;