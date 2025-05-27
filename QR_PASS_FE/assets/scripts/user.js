import alertPopup from "./utils/alert.js";

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// API base URL
const API_BASE_URL = 'https://qr-pass-system-iakb.onrender.com/api';

// Store the original student ID for verification
let originalStudentId = '';

// Registration
document.getElementById('registerBtn').addEventListener('click', () => {
    const studentId = document.getElementById('studentId').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const course = document.getElementById('registerCourse').value;

    if (studentId.length !== 10) {
        alertPopup('Student ID must be exactly 10 characters long');
        return;
    }

    if (!studentId || !name || !course) {
        alertPopup('Please fill in all fields');
        return;
    }

    // Store the original student ID
    originalStudentId = studentId;
    
    // Show verification modal
    showVerificationModal();
});

// Verification Modal Elements
const verificationModal = document.getElementById('verificationModal');
const verifyStudentIdInput = document.getElementById('verifyStudentId');
const confirmVerifyBtn = document.getElementById('confirmVerifyBtn');
const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');
const closeModalBtn = document.querySelector('.close-modal');

// Show verification modal
function showVerificationModal() {
    verificationModal.style.display = 'flex';
    verifyStudentIdInput.value = '';
    verifyStudentIdInput.focus();
}

// Hide verification modal
function hideVerificationModal() {
    verificationModal.style.display = 'none';
}

// Close modal when clicking X button
closeModalBtn.addEventListener('click', hideVerificationModal);

// Close modal when clicking cancel button
cancelVerifyBtn.addEventListener('click', hideVerificationModal);

// Close modal when clicking outside modal content
verificationModal.addEventListener('click', (e) => {
    if (e.target === verificationModal) {
        hideVerificationModal();
    }
});

// Confirm verification
confirmVerifyBtn.addEventListener('click', () => {
    const verifiedStudentId = verifyStudentIdInput.value.trim();
    
    if (!verifiedStudentId) {
        alertPopup('Please enter your Student ID');
        return;
    }
    
    if (verifiedStudentId !== originalStudentId) {
        alertPopup('Student ID does not match. Please try again.');
        verifyStudentIdInput.value = '';
        verifyStudentIdInput.focus();
        return;
    }
    
    // If verification succeeds, proceed with registration
    hideVerificationModal();
    proceedWithRegistration();
});

// The actual registration function (previously registerStudent)
async function proceedWithRegistration() {
    const studentId = originalStudentId;
    const name = document.getElementById('studentName').value.trim();
    const course = document.getElementById('registerCourse').value;
    
    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId,
                name,
                courseName: course
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alertPopup('Registration successful!');
            // Clear form
            document.getElementById('studentId').value = '';
            document.getElementById('studentName').value = '';
            document.getElementById('registerCourse').value = '';
        } else {
            alertPopup(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alertPopup('Registration failed. Please try again.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Student';
    }
}

// QR Generation
document.getElementById('generateQrBtn').addEventListener('click', generateStudentQR);
document.getElementById('downloadBtn').addEventListener('click', downloadQRCode);

const universityLogo = new Image();
universityLogo.src = 'assets/images/UA-LOGO.png';

async function generateStudentQR() {
    const studentId = document.getElementById('qrStudentId').value.trim();
    const course = document.getElementById('qrCourse').value;
    
    if (studentId.length !== 10) {
        alertPopup('Student ID must be exactly 10 characters long');
        return;
    }
    if (!studentId || !course) {
        alertPopup('Please enter student ID and select program');
        return;
    }
    
    const generateBtn = document.getElementById('generateQrBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, courseName: course })
        });
        const data = await response.json();
        
        if (response.ok) {
            const canvas = document.getElementById('qrCodeCanvas');
            canvas.dataset.studentId = studentId;
            canvas.dataset.studentName = data.studentName || 'student';

            // High-res settings with full canvas utilization
            const CARD_WIDTH = canvas.width = 700;
            const CARD_HEIGHT = canvas.height = 1000;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

            // Full canvas gradient background
            const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(1, '#e9ecef');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

            // University header with squared corners
            ctx.save();
            ctx.fillStyle = '#003366';
            ctx.fillRect(0, 0, CARD_WIDTH, 180);
            
            // University name with gold accent
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px "Times New Roman", serif';
            ctx.fillText('UNIVERSITY OF THE ASSUMPTION', CARD_WIDTH/2, 70);

            // Graduation year with decorative elements
            ctx.font = 'bold 28px "Times New Roman", serif';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('GRADUATION 2025', CARD_WIDTH/2, 120);
            
            // Decorative gold line
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(CARD_WIDTH/2 - 100, 140);
            ctx.lineTo(CARD_WIDTH/2 + 100, 140);
            ctx.stroke();
            ctx.restore();

            // Program information
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#003366';
            ctx.font = 'bold 18px "Times New Roman", serif';
            const courseText = `${course.toUpperCase()}`;
            ctx.fillText(courseText, CARD_WIDTH/2, 220);
            ctx.restore();

            // QR Code Container - full width utilization
            const QR_SIZE = 400;
            const QR_TOP = 280;
            const QR_LEFT = (CARD_WIDTH - QR_SIZE)/2;

            // Generate QR code
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = QR_SIZE;
            tempCanvas.height = QR_SIZE;
            await new Promise((resolve, reject) => {
                QRCode.toCanvas(tempCanvas, data.encryptedData, {
                    width: QR_SIZE,
                    margin: 2,
                    errorCorrectionLevel: 'H',
                    color: {
                        dark: '#003366',
                        light: '#ffffff00'
                    }
                }, (error) => error ? reject(error) : resolve());
            });

            // Draw QR with squared corners
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(QR_LEFT - 20, QR_TOP - 20, QR_SIZE + 40, QR_SIZE + 40);
            ctx.restore();

            ctx.drawImage(tempCanvas, QR_LEFT, QR_TOP, QR_SIZE, QR_SIZE);

            // Student information section
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#333333';
            ctx.font = '24px "Times New Roman", serif';
            ctx.fillText('GRADUATE IDENTIFICATION', CARD_WIDTH/2, QR_TOP + QR_SIZE + 60);
            
            ctx.font = 'bold 28px "Times New Roman", serif';
            ctx.fillStyle = '#003366';
            ctx.fillText(studentId, CARD_WIDTH/2, QR_TOP + QR_SIZE + 100);
            
            if (data.studentName) {
                ctx.font = 'italic 22px "Times New Roman", serif';
                ctx.fillStyle = '#555555';
                ctx.fillText(data.studentName.toUpperCase(), CARD_WIDTH/2, QR_TOP + QR_SIZE + 140);
            }
            ctx.restore();

            // Footer with squared corners
            ctx.save();
            ctx.fillStyle = '#003366';
            ctx.fillRect(0, CARD_HEIGHT - 80, CARD_WIDTH, 80);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFD700';
            ctx.font = 'italic 22px "Times New Roman", serif';
            ctx.fillText('Congratulations on Your Achievement!', CARD_WIDTH/2, CARD_HEIGHT - 40);
            ctx.restore();

            document.getElementById('qrCodeContainer').classList.remove('hidden');
        } else {
            alertPopup(data.error || 'Failed to generate QR code');
        }
    } catch (error) {
        console.error('QR generation error:', error);
        alertPopup('Failed to generate QR code. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Graduation QR Pass';
    }
}


// QR DOWNLOAD
function downloadQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas) return;

    // Get student details from the canvas dataset
    const studentId = canvas.dataset.studentId || '';
    const studentName = canvas.dataset.studentName || 'student';
    
    // Create a filename with student ID and name
    let filename = 'GraduationPass';
    if (studentId) filename += `_${studentId}`;
    if (studentName) {
        // Remove special characters and replace spaces with underscores
        const cleanName = studentName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
        filename += `_${cleanName}`;
    }
    filename += '.png';

    // Create a temporary canvas with white background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill with white background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the QR code
    tempCtx.drawImage(canvas, 0, 0);

    // Create download link
    const link = document.createElement('a');
    link.download = filename;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}



async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses`);
        const data = await response.json();
        
        if (response.ok) {
            return data.courses;
        } else {
            throw new Error(data.error || 'Failed to load courses');
        }
    } catch (error) {
        console.error('Course loading error:', error);
        alertPopup('Failed to load programs. Please try again later.');
        return [];
    }
}

// Function to populate select elements with courses
async function populateCourseSelects() {
    const selects = [
        'registerCourse',
        'qrCourse',
    ];
    
    // Show loading state
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.disabled = true;
            // Keep the first option ("Select course")
            while (select.options.length > 1) {
                select.remove(1);
            }
            select.innerHTML += '<option value="" disabled>Loading programs...</option>';
        }
    });
    
    const courses = await loadCourses();
    
    // Populate all select elements
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // Clear existing options except the first one
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Add the default option if it doesn't exist
            if (select.options.length === 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = selectId === 'filterCourse' ? 'All Programs' : 'Select your program';
                select.appendChild(defaultOption);
            }
            
            // Add courses from the database
            courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.name;
                option.textContent = course.name;
                select.appendChild(option);
            });
            
            select.disabled = false;
        }
    });
}

// Add these new event listeners
document.getElementById('registerParentBtn').addEventListener('click', registerParent);
document.getElementById('generateParentQrBtn').addEventListener('click', generateParentQR);
document.getElementById('downloadParentBtn').addEventListener('click', downloadParentQRCode);

// Parent Registration Function
async function registerParent() {
    const studentId = document.getElementById('parentStudentId').value.trim();
    const parentName = document.getElementById('parentName').value.trim();
    const relation = document.getElementById('parentRelation').value;
    
    if (studentId.length !== 10) {
        alertPopup('Student ID must be exactly 10 characters long');
        return;
    }

    if (!studentId || !parentName || !relation) {
        alertPopup('Please fill in all fields');
        return;
    }
    
    const registerBtn = document.getElementById('registerParentBtn');
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/register-parent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId,
                parentName,
                relation
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alertPopup('Parent registered successfully!');
            // Clear form
            document.getElementById('parentStudentId').value = '';
            document.getElementById('parentName').value = '';
            document.getElementById('parentRelation').value = 'Father';
        } else {
            alertPopup(data.error || 'Parent registration failed');
        }
    } catch (error) {
        console.error('Parent registration error:', error);
        alertPopup('Parent registration failed. Please try again.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register Parent';
    }
}

// Parent QR Generation Function
async function generateParentQR() {
    const studentId = document.getElementById('parentQrStudentId').value.trim();
    const parentName = document.getElementById('parentQrName').value.trim();
    
    if (studentId.length !== 10) {
        alertPopup('Student ID must be exactly 10 characters long');
        return;
    }
    if (!studentId || !parentName) {
        alertPopup('Please enter student ID and parent name');
        return;
    }
    
    const generateBtn = document.getElementById('generateParentQrBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating Parent Pass...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-parent-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, parentName })
        });
        const data = await response.json();
        
        if (response.ok) {
            const canvas = document.getElementById('parentQrCodeCanvas');
            canvas.dataset.studentId = studentId;
            canvas.dataset.parentName = parentName;

            // Full canvas dimensions
            const CARD_WIDTH = canvas.width = 700;
            const CARD_HEIGHT = canvas.height = 1000;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

            // Full canvas gradient background
            const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
            gradient.addColorStop(0, '#f8f1f1');
            gradient.addColorStop(1, '#e9d8d8');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

            // University header with squared corners
            ctx.save();
            ctx.fillStyle = '#800000';
            ctx.fillRect(0, 0, CARD_WIDTH, 180);
            
            // University name
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px "Times New Roman", serif';
            ctx.fillText('UNIVERSITY OF THE ASSUMPTION', CARD_WIDTH/2, 70);

            // Parent pass designation
            ctx.font = 'bold 28px "Times New Roman", serif';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('PARENT COMMENCEMENT PASS', CARD_WIDTH/2, 120);
            
            // Decorative gold line
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(CARD_WIDTH/2 - 120, 140);
            ctx.lineTo(CARD_WIDTH/2 + 120, 140);
            ctx.stroke();
            ctx.restore();

            // QR Code Container - full width utilization
            const QR_SIZE = 400;
            const QR_TOP = 280;
            const QR_LEFT = (CARD_WIDTH - QR_SIZE)/2;

            // Generate QR code
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = QR_SIZE;
            tempCanvas.height = QR_SIZE;
            await new Promise((resolve, reject) => {
                QRCode.toCanvas(tempCanvas, data.encryptedData, {
                    width: QR_SIZE,
                    margin: 2,
                    errorCorrectionLevel: 'H',
                    color: {
                        dark: '#800000',
                        light: '#ffffff00'
                    }
                }, (error) => error ? reject(error) : resolve());
            });

            // Draw QR with squared corners
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(QR_LEFT - 20, QR_TOP - 20, QR_SIZE + 40, QR_SIZE + 40);
            ctx.restore();

            ctx.drawImage(tempCanvas, QR_LEFT, QR_TOP, QR_SIZE, QR_SIZE);

            // Parent information section
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#333333';
            ctx.font = '24px "Times New Roman", serif';
            ctx.fillText('PARENT/GUARDIAN OF GRADUATE', CARD_WIDTH/2, QR_TOP + QR_SIZE + 60);
            
            ctx.font = 'bold 26px "Times New Roman", serif';
            ctx.fillStyle = '#800000';
            ctx.fillText(parentName.toUpperCase(), CARD_WIDTH/2, QR_TOP + QR_SIZE + 100);
            
            ctx.font = '20px "Times New Roman", serif';
            ctx.fillStyle = '#555555';
            ctx.fillText(`Student ID: ${studentId}`, CARD_WIDTH/2, QR_TOP + QR_SIZE + 140);
            ctx.restore();

            // Footer with squared corners
            ctx.save();
            ctx.fillStyle = '#800000';
            ctx.fillRect(0, CARD_HEIGHT - 80, CARD_WIDTH, 80);
            
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFD700';
            ctx.font = 'italic 22px "Times New Roman", serif';
            ctx.fillText('We Honor Your Support and Dedication', CARD_WIDTH/2, CARD_HEIGHT - 40);
            ctx.restore();

            document.getElementById('parentQrCodeContainer').classList.remove('hidden');
        } else {
            alertPopup(data.error || 'Failed to generate parent QR code');
        }
    } catch (error) {
        console.error('Parent QR generation error:', error);
        alertPopup('Failed to generate parent QR code. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Parent QR Pass';
    }
}

// Parent QR Download Function
function downloadParentQRCode() {
    const canvas = document.getElementById('parentQrCodeCanvas');
    if (!canvas) return;

    const studentId = canvas.dataset.studentId || '';
    const parentName = canvas.dataset.parentName || 'parent';
    
    let filename = 'ParentGraduationPass';
    if (studentId) filename += `_${studentId}`;
    if (parentName) {
        const cleanName = parentName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
        filename += `_${cleanName}`;
    }
    filename += '.png';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = filename;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    populateCourseSelects();
});