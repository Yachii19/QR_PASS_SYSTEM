const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Course = require('../models/Course');
const CryptoJS = require('crypto-js');
const { errorResponse } = require('../utils/responses');

exports.verifyQR = async (req, res) => {
    try {
        const { encryptedData, courseName } = req.body; // Removed userProvidedKey
        
        if (!encryptedData || !courseName) {
            return errorResponse(res, 400, 'All fields (encryptedData, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        let decryptedString;
        try {
            // Use the course's encryptionKey from database instead of user provided key
            const bytes = CryptoJS.AES.decrypt(encryptedData, course.encryption_key);
            decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) {
                return errorResponse(res, 401, 'Invalid QR code - decryption failed');
            }
        } catch (decryptError) {
            return errorResponse(res, 401, 'Invalid QR code format');
        }

        let decryptedData;
        try {
            decryptedData = JSON.parse(decryptedString);
        } catch (parseError) {
            return errorResponse(res, 400, 'Invalid QR code format - could not parse decrypted data');
        }

        if (!decryptedData.student_id || !decryptedData.name || !decryptedData.course) {
            return errorResponse(res, 400, 'Invalid QR code format - missing required fields');
        }

        const student = await Student.findOne({ student_id: decryptedData.student_id })
            .populate('course_id', 'name');
            
        if (!student) {
            return errorResponse(res, 404, 'Student not found in database');
        }

        if (student.course_id.name !== courseName) {
            return errorResponse(res, 403, 'Student does not belong to this course');
        }

        const latestAttendance = await Attendance.findOne({
            student_id: student._id,
            time_out: { $exists: false }
        }).sort({ time_in: -1 });
        
        if (latestAttendance) {
            latestAttendance.time_out = new Date();
            await latestAttendance.save();
            
            return res.json({
                success: true,
                action: 'time_out',
                message: 'Time out recorded successfully',
                student: {
                    studentId: student.student_id,
                    name: student.name,
                    course: student.course_id.name
                },
                time_in: latestAttendance.time_in,
                time_out: latestAttendance.time_out
            });
        }
        
        const newAttendance = new Attendance({
            student_id: student._id,
            time_in: new Date(),
            date_in: new Date()
        });
        
        await newAttendance.save();
        res.json({
            success: true,
            action: 'time_in',
            message: 'Time in recorded successfully',
            student: {
                studentId: student.student_id,
                name: student.name,
                course: student.course_id.name
            },
            time_in: newAttendance.time_in
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        errorResponse(res, 500, 'Internal server error during verification');
    }
};

exports.decryptQR = async (req, res) => {
    try {
        const { encryptedData, courseName } = req.body;
        
        if (!encryptedData || !courseName) {
            return errorResponse(res, 400, 'All fields (encryptedData, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        let decryptedString;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, course.encryption_key);
            decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) {
                return errorResponse(res, 401, 'Invalid QR code - decryption failed');
            }
        } catch (decryptError) {
            return errorResponse(res, 401, 'Invalid QR code format');
        }

        let decryptedData;
        try {
            decryptedData = JSON.parse(decryptedString);
        } catch (parseError) {
            return errorResponse(res, 400, 'Invalid QR code format - could not parse decrypted data');
        }

        if (!decryptedData.student_id || !decryptedData.name || !decryptedData.course) {
            return errorResponse(res, 400, 'Invalid QR code format - missing required fields');
        }

        // Return the decrypted data without recording attendance
        res.json({
            success: true,
            student: {
                studentId: decryptedData.student_id,
                name: decryptedData.name,
                course: decryptedData.course
            }
        });
        
    } catch (error) {
        console.error('Decryption error:', error);
        errorResponse(res, 500, 'Internal server error during decryption');
    }
};

exports.getAttendances = async (req, res) => {
    try {
        const { date, course } = req.query;
        
        let query = {};
        if (date) { 
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date_in = { $gte: startDate, $lte: endDate };
        }
        
        if (course) {
            const courseObj = await Course.findOne({ name: course });
            if (courseObj) {
                const students = await Student.find({ course_id: courseObj._id });
                query.student_id = { $in: students.map(s => s._id) };
            }
        }
        
        const attendances = await Attendance.find(query)
            .populate({
                path: 'student_id',
                select: 'student_id name course_id',
                populate: {
                    path: 'course_id',
                    select: 'name'
                }
            })
            .sort({ date_in: -1, time_in: -1 });
        
        const processedAttendances = attendances.map(a => {
            if (!a.student_id) {
                return null;
            }
            
            let courseName = 'Unknown Course';
            if (a.student_id.course_id && a.student_id.course_id.name) {
                courseName = a.student_id.course_id.name;
            } else if (a.student_id.course_id) {
                return Course.findById(a.student_id.course_id)
                    .then(course => ({
                        studentId: a.student_id.student_id,
                        studentName: a.student_id.name,
                        course: course?.name || 'Unknown Course',
                        timeIn: a.time_in,
                        timeOut: a.time_out,
                        date: a.date_in
                    }))
                    .catch(() => ({
                        studentId: a.student_id.student_id,
                        studentName: a.student_id.name,
                        course: 'Unknown Course',
                        timeIn: a.time_in,
                        timeOut: a.time_out,
                        date: a.date_in
                    }));
            }
            
            return {
                studentId: a.student_id.student_id,
                studentName: a.student_id.name,
                course: courseName,
                timeIn: a.time_in,
                timeOut: a.time_out,
                date: a.date_in
            };
        });
        
        const resolvedAttendances = await Promise.all(processedAttendances);
        const validAttendances = resolvedAttendances.filter(a => a !== null);
        
        res.json({
            success: true,
            attendances: validAttendances
        });
    } catch (error) {
        console.error('Get attendances error:', error);
        errorResponse(res, 500, 'Failed to fetch attendances');
    }
};