const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Course = require('../models/Course');
const { errorResponse } = require('../utils/responses');
const CryptoJS = require('crypto-js');


exports.registerStudent = async (req, res) => {
    try {
        const { studentId, name, courseName } = req.body;
        
        if (!studentId || !name || !courseName) {
            return errorResponse(res, 400, 'All fields (studentId, name, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }
        
        const existingStudent = await Student.findOne({ student_id: studentId });
        if (existingStudent) {
            return errorResponse(res, 409, 'Student already registered');
        }
        
        const student = new Student({
            student_id: studentId,
            name,
            course_id: course._id
        });
        
        await student.save();
        res.json({ 
            success: true, 
            message: 'Student registered successfully',
            studentId: student.student_id
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return errorResponse(res, 400, 'Validation error', error.errors);
        }
        console.error('Registration error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.generateQR = async (req, res) => {
    try {
        const { studentId, courseName } = req.body;
        
        if (!studentId || !courseName) {
            return errorResponse(res, 400, 'Both studentId and courseName are required');
        }

        const student = await Student.findOne({ student_id: studentId })
            .populate('course_id');
            
        if (!student) {
            return errorResponse(res, 404, 'Student not found');
        }
        
        if (student.course_id.name !== courseName) {
            return errorResponse(res, 403, 'Student does not belong to this course');
        }
        
        const studentData = {
            student_id: student.student_id,
            name: student.name,
            course: courseName,
            timestamp: new Date().toISOString()
        };
        
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(studentData),
            student.course_id.encryption_key
        ).toString();
        
        res.json({
            success: true,
            encryptedData: encrypted
        });
    } catch (error) {
        console.error('QR generation error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.registerParent = async (req, res) => {
    try {
        const { studentId, parentName, relation } = req.body;
        
        if (!studentId || !parentName || !relation) {
            return errorResponse(res, 400, 'All fields (studentId, parentName, relation) are required');
        }

        // Check if student exists
        const student = await Student.findOne({ student_id: studentId });
        if (!student) {
            return errorResponse(res, 404, 'Student not found');
        }

        // Check if parent already registered for this student
        const existingParent = await Parent.findOne({ 
            student_id: student._id,
            name: parentName 
        });
        
        if (existingParent) {
            return errorResponse(res, 409, 'Parent already registered for this student');
        }

        // Check parent limit (2 per student)
        const parentCount = await Parent.countDocuments({ student_id: student._id });
        if (parentCount >= 2) {
            return errorResponse(res, 400, 'Maximum of 2 parents/guardians allowed per student');
        }

        const parent = new Parent({
            student_id: student._id,
            name: parentName,
            relation,
            course_id: student.course_id
        });
        
        await parent.save();
        res.json({ 
            success: true, 
            message: 'Parent registered successfully',
            parentId: parent._id
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return errorResponse(res, 400, 'Validation error', error.errors);
        }
        console.error('Parent registration error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.generateParentQR = async (req, res) => {
    try {
        const { studentId, parentName } = req.body;
        
        if (!studentId || !parentName) {
            return errorResponse(res, 400, 'Both studentId and parentName are required');
        }

        // Find student and parent
        const student = await Student.findOne({ student_id: studentId })
            .populate('course_id');
            
        if (!student) {
            return errorResponse(res, 404, 'Student not found');
        }
        
        const parent = await Parent.findOne({ 
            name: parentName,
            student_id: student._id
        }).populate('course_id');
        
        if (!parent) {
            return errorResponse(res, 404, 'Parent not registered for this student');
        }
        
        const parentData = {
            type: 'parent',
            student_id: student.student_id,
            parent_id: parent._id,
            name: parent.name,
            relation: parent.relation,
            course: student.course_id.name,
            timestamp: new Date().toISOString()
        };
        
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(parentData),
            student.course_id.encryption_key
        ).toString();
        
        res.json({
            success: true,
            encryptedData: encrypted
        });
    } catch (error) {
        console.error('Parent QR generation error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};