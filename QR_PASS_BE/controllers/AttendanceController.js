const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Parent = require('../models/Parent')
const CryptoJS = require('crypto-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { errorResponse } = require('../utils/responses');

exports.verifyQR = async (req, res) => {
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

        // Handle parent QR codes
        if (decryptedData.type === 'parent') {
            if (!decryptedData.parent_id || !decryptedData.student_id || !decryptedData.name) {
                return errorResponse(res, 400, 'Invalid parent QR code format - missing required fields');
            }

            const parent = await Parent.findById(decryptedData.parent_id)
                .populate('student_id')
                .populate('course_id');
                
            if (!parent) {
                return errorResponse(res, 404, 'Parent not found in database');
            }

            if (parent.course_id.name !== courseName) {
                return errorResponse(res, 403, 'Parent does not belong to this course');
            }

            if (parent.student_id.student_id !== decryptedData.student_id) {
                return errorResponse(res, 403, 'Parent QR code does not match student');
            }

            const latestAttendance = await Attendance.findOne({
                parent_id: parent._id,
                time_out: { $exists: false }
            }).sort({ time_in: -1 });
            
            if (latestAttendance) {
                latestAttendance.time_out = new Date();
                await latestAttendance.save();
                
                return res.json({
                    success: true,
                    action: 'time_out',
                    message: 'Parent time out recorded successfully',
                    parent: {
                        name: parent.name,
                        relation: parent.relation,
                        studentId: parent.student_id.student_id,
                        studentName: parent.student_id.name,
                        course: courseName
                    },
                    time_in: latestAttendance.time_in,
                    time_out: latestAttendance.time_out
                });
            }
            
            const newAttendance = new Attendance({
                parent_id: parent._id,
                student_id: parent.student_id._id,
                time_in: new Date(),
                date_in: new Date()
            });
            
            await newAttendance.save();
            return res.json({
                success: true,
                action: 'time_in',
                message: 'Parent time in recorded successfully',
                parent: {
                    name: parent.name,
                    relation: parent.relation,
                    studentId: parent.student_id.student_id,
                    studentName: parent.student_id.name,
                    course: courseName
                },
                time_in: newAttendance.time_in
            });
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
            .populate({
                path: 'parent_id',
                select: 'name relation student_id',
                populate: {
                    path: 'student_id',
                    select: 'student_id name course_id',
                    populate: {
                        path: 'course_id',
                        select: 'name'
                    }
                }
            })
            .sort({ date_in: -1, time_in: -1 });
        
        const processedAttendances = attendances.map(a => {
            // If neither student nor parent is present, skip this record
            if (!a.student_id && !a.parent_id) {
                return null;
            }

            let courseName = 'Unknown Course';
            if (a.student_id && a.student_id.course_id && a.student_id.course_id.name) {
                courseName = a.student_id.course_id.name;
            }

            const studentDetails = a.student_id
                ? {
                    studentId: a.student_id.student_id,
                    studentName: a.student_id.name,
                    course: courseName
                }
                : null;

            const parentDetails = a.parent_id
                ? {
                    parentName: a.parent_id.name,
                    relation: a.parent_id.relation,
                    studentId: a.parent_id.student_id?.student_id || 'Unknown',
                    studentName: a.parent_id.student_id?.name || 'Unknown',
                    course: a.parent_id.student_id?.course_id?.name || 'Unknown Course'
                }
                : null;

            return {
                student: studentDetails,
                parent: parentDetails,
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

exports.clearAttendances = async (req, res) => {
    try {
        const { date, course } = req.body;
        
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
        
        const result = await Attendance.deleteMany(query);
        
        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} attendance records`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Clear attendances error:', error);
        errorResponse(res, 500, 'Failed to clear attendance records');
    }
};

exports.generateAttendancePDF = async (req, res) => {
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
            .populate({
                path: 'parent_id',
                select: 'name relation student_id',
                populate: {
                    path: 'student_id',
                    select: 'student_id name course_id',
                    populate: {
                        path: 'course_id',
                        select: 'name'
                    }
                }
            })
            .sort({ date_in: -1, time_in: -1 });

        if (attendances.length === 0) {
            return res.status(404).json({ error: 'No attendance records found for the selected filters' });
        }

        // Create a PDF document in landscape format with better margins
        const doc = new PDFDocument({
            margin: 30,
            size: 'A4',
            layout: 'landscape',
            bufferPages: true
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');

        // Generate filename based on filters
        let filename = 'Attendance_Records';
        if (date) filename += `_${date.replace(/-/g, '')}`;
        if (course) filename += `_${course.replace(/\s+/g, '_')}`;
        filename += '.pdf';

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Handle stream errors
        doc.on('error', (err) => {
            console.error('PDF stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate PDF' });
            }
        });

        // Pipe the PDF to the response
        doc.pipe(res);

        // Add professional header with logo and title
        doc.fillColor('#333333')
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('ATTENDANCE RECORDS', {
                align: 'center',
                underline: true,
                margin: [0, 10, 0, 20]
            });

        // Add filters info in a bordered box
        doc.rect(30, doc.y, doc.page.width - 60, 60)
            .fill('#f5f5f5')
            .stroke('#dddddd');

        doc.fillColor('#444444')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Report Filters:', 40, doc.y + 15);

        doc.font('Helvetica')
            .fillColor('#666666');

        let filterY = doc.y + 15;
        if (date) {
            doc.text(`• Date: ${date}`, 50, filterY);
            filterY += 20;
        }
        if (course) {
            doc.text(`• Course: ${course}`, 50, filterY);
            filterY += 20;
        }

        doc.text(`• Generated: ${new Date().toLocaleString()}`, 50, filterY);
        doc.moveDown(2);

        // Create table with landscape-optimized layout
        const headers = ['Student/Parent ID', 'Name', 'Course', 'Time In', 'Time Out', 'Date', 'Status'];
        const columnWidths = [120, 120, 220, 80, 80, 90, 70];
        const rowHeight = 25;
        const tableTop = doc.y;

        // Draw table headers with background
        doc.fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(9);

        let x = 30;
        headers.forEach((header, i) => {
            doc.rect(x, tableTop, columnWidths[i], rowHeight)
                .fill('#2c3e50')
                .stroke('#2c3e50');

            doc.fillColor('#ffffff')
                .text(header, x + 5, tableTop + 8, {
                    width: columnWidths[i] - 10,
                    align: 'left',
                    lineBreak: false
                });

            x += columnWidths[i];
        });

        // Set initial position for data rows
        let y = tableTop + rowHeight;
        doc.font('Helvetica')
            .fontSize(9)
            .fillColor('#333333');

        // Add attendance data with alternating row colors
        attendances.forEach((att, index) => {
            const rowColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            x = 30;

            let rowData;
            if (att.parent_id) {
                rowData = [
                    `${att.parent_id.student_id?.student_id || 'Unknown'} (${att.parent_id.relation})`,
                    att.parent_id.name,
                    att.parent_id.student_id?.course_id?.name || 'Unknown',
                    new Date(att.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    att.time_out
                        ? new Date(att.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A',
                    new Date(att.date_in).toLocaleDateString(),
                    att.time_out ? 'Signed Out' : 'Present'
                ];
            } else if (att.student_id) {
                rowData = [
                    att.student_id.student_id,
                    att.student_id.name,
                    att.student_id.course_id?.name || 'Unknown',
                    new Date(att.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    att.time_out
                        ? new Date(att.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A',
                    new Date(att.date_in).toLocaleDateString(),
                    att.time_out ? 'Signed Out' : 'Present'
                ];
            } else {
                return; // Skip invalid records
            }

            // Draw row background
            headers.forEach((_, i) => {
                doc.rect(x, y, columnWidths[i], rowHeight)
                    .fill(rowColor)
                    .stroke('#eeeeee');
                x += columnWidths[i];
            });

            // Draw row content
            x = 30;
            rowData.forEach((cell, i) => {
                const textOptions = {
                    width: columnWidths[i] - 10,
                    align: 'left',
                    ellipsis: true
                };

                doc.fillColor('#333333')
                    .text(cell, x + 5, y + 8, textOptions);

                x += columnWidths[i];
            });

            y += rowHeight;

            // Check for page break (accounting for landscape height)
            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage({
                    size: 'A4',
                    layout: 'landscape',
                    margin: 30
                });
                y = 30;

                // Redraw headers on the new page
                x = 30;
                doc.fillColor('#ffffff')
                    .font('Helvetica-Bold')
                    .fontSize(9);

                headers.forEach((header, i) => {
                    doc.rect(x, y, columnWidths[i], rowHeight)
                        .fill('#2c3e50')
                        .stroke('#2c3e50');

                    doc.fillColor('#ffffff')
                        .text(header, x + 5, y + 8, {
                            width: columnWidths[i] - 10,
                            align: 'left'
                        });

                    x += columnWidths[i];
                });

                y += rowHeight;
                doc.font('Helvetica')
                    .fontSize(9)
                    .fillColor('#333333');
            }
        });

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    }
};