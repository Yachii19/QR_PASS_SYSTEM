const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/AttendanceController');
const { verifyAdmin } = require('../middlewares/auth');

router.post('/verify-qr', attendanceController.verifyQR);
router.get('/', verifyAdmin, attendanceController.getAttendances);

module.exports = router;