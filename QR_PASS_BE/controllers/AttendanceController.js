const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Parent = require('../models/Parent')
const CryptoJS = require('crypto-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { errorResponse } = require('../utils/responses');
const { DateTime, Duration } = require('luxon');
const TIMEZONE = 'Asia/Manila';


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
        const TIMEZONE = 'Asia/Manila';
        
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

// Utility: Format time in "hh:mm:ss AM/PM" in Asia/Manila
function formatTime(date, tz = TIMEZONE) {
    if (!date) return 'N/A';
    return DateTime.fromJSDate(new Date(date), { zone: tz }).toFormat('hh:mm:ss a'); // 12-hour format with AM/PM
}

// Utility: Format the generated date in "yyyy-LL-dd hh:mm:ss AM/PM"
function formatGeneratedDate(date = DateTime.now(), tz = TIMEZONE) {
    return DateTime.fromJSDate(new Date(date), { zone: tz }).toFormat('yyyy-LL-dd hh:mm:ss a');
}

// Utility: Format duration in H M S
function formatDuration(ms) {
    if (!ms || ms < 0) return 'N/A';
    const dur = Duration.fromMillis(ms).shiftTo('hours', 'minutes', 'seconds').toObject();
    const h = Math.floor(dur.hours || 0);
    const m = Math.floor(dur.minutes || 0);
    const s = Math.floor(dur.seconds || 0);
    return `${h}h ${m}m ${s}s`;
}

// Utility: Estimate row height for wrapped text in PDF table rows
function getRowHeight(doc, rowData, columnWidths, font, fontSize, verticalPadding) {
    let maxHeight = 0;
    rowData.forEach((cell, i) => {
        const text = cell ? String(cell) : '';
        const width = columnWidths[i] - 10;
        doc.font(font).fontSize(fontSize);
        const height = doc.heightOfString(text, { width });
        maxHeight = Math.max(maxHeight, height);
    });
    return Math.ceil(maxHeight + verticalPadding);
}

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

        let courseObj = null;
        if (course) {
            courseObj = await Course.findOne({ name: course });
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

        // Create a PDF document with professional styling
        const doc = new PDFDocument({
            margin: 20,
            size: 'A4',
            layout: 'landscape',
            bufferPages: true
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        let filename = 'Attendance_Report';
        if (date) filename += `_${date.replace(/-/g, '')}`;
        if (course) filename += `_${course.replace(/\s+/g, '_')}`;
        filename += '.pdf';
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Handle stream errors
        doc.on('error', (err) => {
            console.error('PDF stream error:', err);
        });

        // Pipe the PDF to the response
        doc.pipe(res);

        // HEADER
        doc.fillColor('#2c3e50')
            .fontSize(16)
            .font('Helvetica-Bold')
            .text('ATTENDANCE REPORT', {
                align: 'center',
                underline: false,
                margin: [0, 10, 0, 15]
            });

        // METADATA BOX
        doc.rect(20, doc.y, doc.page.width - 40, 50)
            .fill('#f8f9fa')
            .stroke('#e9ecef');

        doc.fillColor('#495057')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('REPORT DETAILS', 30, doc.y + 10);

        doc.font('Helvetica').fillColor('#6c757d');
        let metaY = doc.y + 10;
        if (date) {
            doc.text(`• Date: ${date}`, 40, metaY + 15);
        }
        if (course) {
            doc.text(`• Course: ${course}`, 30, metaY + 5);
        }
        doc.text(
            `• Generated: ${formatGeneratedDate()}`,
            30,
            metaY - 10
        );
        doc.text(`• Total Records: ${attendances.length}`, 500, metaY - 10);

        doc.moveTo(20, doc.y + 40)
            .lineTo(doc.page.width - 20, doc.y + 40)
            .stroke('#dee2e6')
            .moveDown(2);

        // SUMMARY
        // Calculate summary statistics
        const summary = {};
        attendances.forEach(att => {
            const courseName = att.parent_id 
                ? att.parent_id.student_id?.course_id?.name 
                : att.student_id?.course_id?.name;

            if (!courseName) return;

            if (!summary[courseName]) {
                summary[courseName] = {
                    students: 0,
                    parents: 0,
                    total: 0
                };
            }

            if (att.parent_id) {
                summary[courseName].parents++;
            } else {
                summary[courseName].students++;
            }
            summary[courseName].total++;
        });

        doc.fillColor('#2c3e50')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('ATTENDANCE SUMMARY', 20, doc.y, {
                align: 'left',
                underline: false,
                margin: [0, 20, 0, 10]
            });

        // Summary table
        const summaryHeaders = ['Course', 'Students', 'Parents', 'Total'];
        const summaryWidths = [300, 100, 100, 100];
        const summaryY = doc.y;

        // Table header
        doc.fillColor('#2c3e50')
            .rect(20, summaryY, doc.page.width - 40, 25)
            .fill();

        let x = 20;
        summaryHeaders.forEach((header, i) => {
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(10)
                .text(header, x + 10, summaryY + 8, {
                    width: summaryWidths[i],
                    align: i > 0 ? 'center' : 'left'
                });
            x += summaryWidths[i];
        });

        // Table rows
        doc.font('Helvetica').fontSize(10);
        let y = summaryY + 25;
        Object.entries(summary).forEach(([courseName, stats], index) => {
            const rowColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
            doc.fillColor(rowColor)
                .rect(20, y, doc.page.width - 40, 25)
                .fill();

            doc.strokeColor('#e9ecef')
                .moveTo(20, y)
                .lineTo(doc.page.width - 20, y)
                .stroke();

            doc.fillColor('#212529')
                .text(courseName, 30, y + 8, {
                    width: summaryWidths[0] - 20,
                    align: 'left'
                });
            doc.text(stats.students.toString(), 320, y + 8, {
                width: summaryWidths[1],
                align: 'center'
            });
            doc.text(stats.parents.toString(), 420, y + 8, {
                width: summaryWidths[2],
                align: 'center'
            });
            doc.text(stats.total.toString(), 520, y + 8, {
                width: summaryWidths[3],
                align: 'center'
            });

            y += 25;
        });

        doc.moveDown(2);

        // DETAILED RECORDS
        doc.addPage({
            size: 'A4',
            layout: 'landscape',
            margin: 20
        });

        doc.fillColor('#2c3e50')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('DETAILED ATTENDANCE RECORDS', {
                underline: false,
                margin: [0, 10, 0, 15]
            });

        // Table setup
        const headers = ['ID', 'Name', 'Role', 'Course', 'Time In', 'Time Out', 'Duration', 'Status'];
        const columnWidths = [80, 120, 70, 150, 80, 80, 80, 70];
        const defaultRowHeight = 25;
        const font = 'Helvetica';
        const fontSize = 9;
        const verticalPadding = 16;

        // Draw table header at a fixed Y position
        const tableTopY = doc.y + 10;
        x = 20;
        doc.fillColor('#2c3e50')
            .rect(20, tableTopY, doc.page.width - 40, defaultRowHeight)
            .fill();

        x = 20;
        headers.forEach((header, i) => {
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(fontSize)
                .text(header, x + 5, tableTopY + 8, {
                    width: columnWidths[i] - 10,
                    align: i > 3 ? 'center' : 'left'
                });
            x += columnWidths[i];
        });

        // Reset Y position for the first row after the header
        y = tableTopY + defaultRowHeight;

        // Table rows
        doc.font(font).fontSize(fontSize);

        let pageCount = 1;

        attendances.forEach((att, index) => {
            let rowData;
            if (att.parent_id) {
                const duration = att.time_out 
                    ? formatDuration(new Date(att.time_out) - new Date(att.time_in)) 
                    : 'N/A';
                rowData = [
                    `${att.parent_id.student_id?.student_id || 'N/A'}`,
                    att.parent_id.name,
                    att.parent_id.relation,
                    att.parent_id.student_id?.course_id?.name || 'N/A',
                    formatTime(att.time_in, TIMEZONE),
                    att.time_out ? formatTime(att.time_out, TIMEZONE) : 'N/A',
                    duration,
                    att.time_out ? 'Signed Out' : 'Present'
                ];
            } else if (att.student_id) {
                const duration = att.time_out 
                    ? formatDuration(new Date(att.time_out) - new Date(att.time_in)) 
                    : 'N/A';
                rowData = [
                    att.student_id.student_id,
                    att.student_id.name,
                    'Student',
                    att.student_id.course_id?.name || 'N/A',
                    formatTime(att.time_in, TIMEZONE),
                    att.time_out ? formatTime(att.time_out, TIMEZONE) : 'N/A',
                    duration,
                    att.time_out ? 'Signed Out' : 'Present'
                ];
            } else {
                return; // Skip invalid records
            }

            const dynamicRowHeight = getRowHeight(doc, rowData, columnWidths, font, fontSize, verticalPadding);

            // Check for page break
            if (y + dynamicRowHeight > doc.page.height - 30) {
                doc.addPage({
                    size: 'A4',
                    layout: 'landscape',
                    margin: 20
                });
                pageCount++;

                doc.fillColor('#f8f9fa')
                    .fontSize(8)
                    .text(`Page ${pageCount} - Continued`, 20, 10);

                // Redraw table headers at new fixed position
                y = 30;
                x = 20;
                doc.fillColor('#2c3e50')
                    .rect(20, y, doc.page.width - 40, defaultRowHeight)
                    .fill();
                x = 20;
                headers.forEach((header, i) => {
                    doc.fillColor('#ffffff')
                        .font('Helvetica-Bold')
                        .fontSize(fontSize)
                        .text(header, x + 5, y + 8, {
                            width: columnWidths[i] - 10,
                            align: i > 3 ? 'center' : 'left'
                        });
                    x += columnWidths[i];
                });
                y += defaultRowHeight;
            }

            // Alternate row colors
            const rowColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
            doc.fillColor(rowColor)
                .rect(20, y, doc.page.width - 40, dynamicRowHeight)
                .fill();

            doc.strokeColor('#e9ecef')
                .moveTo(20, y)
                .lineTo(doc.page.width - 20, y)
                .stroke();

            x = 20;
            rowData.forEach((cell, i) => {
                doc.fillColor('#212529')
                    .font(font)
                    .fontSize(fontSize)
                    .text(cell ? String(cell) : '', x + 5, y + 8, {
                        width: columnWidths[i] - 10,
                        align: i > 3 ? 'center' : 'left',
                        height: dynamicRowHeight - verticalPadding
                    });
                x += columnWidths[i];
            });

            y += dynamicRowHeight;
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

// Add this to attendanceController.js
exports.getCurrentAttendances = async (req, res) => {
    try {
        const attendances = await Attendance.find({ 
            time_out: { $exists: false } 
        })
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
        .sort({ time_in: 1 });

        const processedAttendances = attendances.map(a => {
            if (a.parent_id) {
                return {
                    parent: {
                        parentName: a.parent_id.name,
                        relation: a.parent_id.relation,
                        studentId: a.parent_id.student_id?.student_id || 'Unknown',
                        course: a.parent_id.student_id?.course_id?.name || 'Unknown Course'
                    },
                    timeIn: a.time_in
                };
            } else if (a.student_id) {
                return {
                    student: {
                        studentId: a.student_id.student_id,
                        studentName: a.student_id.name,
                        course: a.student_id.course_id?.name || 'Unknown Course'
                    },
                    timeIn: a.time_in
                };
            }
            return null;
        }).filter(a => a !== null);

        res.json({
            success: true,
            attendances: processedAttendances
        });
    } catch (error) {
        console.error('Get current attendances error:', error);
        errorResponse(res, 500, 'Failed to fetch current attendances');
    }
};