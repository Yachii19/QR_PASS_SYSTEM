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
const API_BASE_URL = 'http://localhost:4000/api';

// Registration
document.getElementById('registerBtn').addEventListener('click', registerStudent);

async function registerStudent() {
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

async function generateStudentQR() {
    const studentId = document.getElementById('qrStudentId').value.trim();
    const course = document.getElementById('qrCourse').value;
    
    
    if (studentId.length !== 10) {
        alertPopup('Student ID must be exactly 10 characters long');
        return;
    }

    if (!studentId || !course) {
        alertPopup('Please enter student ID and select course');
        return;
    }
    
    const generateBtn = document.getElementById('generateQrBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentId,
                courseName: course
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store student data for download
            document.getElementById('qrCodeCanvas').dataset.studentId = studentId;
            document.getElementById('qrCodeCanvas').dataset.studentName = data.studentName || 'student';
            
            // Clear previous QR code
            const canvas = document.getElementById('qrCodeCanvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set canvas size explicitly
            canvas.width = 300;
            canvas.height = 300;
            
            // Generate QR code directly to canvas
            QRCode.toCanvas(canvas, data.encryptedData, {
                width: 250,
                margin: 2,
                errorCorrectionLevel: 'H'
            }, (error) => {
                if (error) {
                    console.error('QR generation error:', error);
                    alertPopup('Failed to generate QR code');
                } else {
                    document.getElementById('qrCodeContainer').classList.remove('hidden');
                }
            });
        } else {
            alertPopup(data.error || 'Failed to generate QR code');
        }
    } catch (error) {
        console.error('QR generation error:', error);
        alertPopup('Failed to generate QR code. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Pass';
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
// QR Verification
const verifyCourseSelect = document.getElementById('verifyCourse');
const uploadBtn = document.getElementById('uploadBtn');
const qrFile = document.getElementById('qrFile');
const verificationResult = document.getElementById('verificationResult');
const verificationMessage = document.getElementById('verificationMessage');
const newVerifyBtn = document.getElementById('newVerifyBtn');

// Load courses for verification dropdown
async function loadCoursesForVerification() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses/full`);
        const data = await response.json();
        
        if (response.ok) {
            // Clear existing options except the first one
            while (verifyCourseSelect.options.length > 1) {
                verifyCourseSelect.remove(1);
            }
            
            // Add courses from backend
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.name;
                option.textContent = course.name;
                verifyCourseSelect.appendChild(option);
            });
        } else {
            throw new Error(data.error || 'Failed to load courses');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load courses', false);
    }
}

// Handle file upload
uploadBtn.addEventListener('click', () => {
    qrFile.click();
});

qrFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    const selectedCourse = verifyCourseSelect.value;
    if (!selectedCourse) {
        // Clear the file input
        event.target.value = '';
        
        // Show modal
        const modal = document.getElementById('customAlert');
        const message = document.getElementById('alertMessage');
        const closeButton = document.getElementById('alertCloseButton');
        
        // Set modal content
        message.textContent = 'Please select a course first';
        document.body.classList.add("modal-open");
        modal.style.display = "flex";
        
        // Handle modal closing
        const closeModal = () => {
            modal.style.display = "none";
            document.body.classList.remove("modal-open");
            // Remove event listeners
            closeButton.removeEventListener('click', closeModal);
            document.removeEventListener('keydown', handleEscape);
        };
        
        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        
        // Add event listeners
        closeButton.addEventListener('click', closeModal);
        document.addEventListener('keydown', handleEscape);
        
        // Close modal after 2 seconds
        setTimeout(closeModal, 2000);
        return;
    }

    // Hide initial elements
    document.querySelector('#verify .form-group').classList.add('hidden');
    document.querySelector('.decrypt-options').classList.add('hidden');

    // Show verification container immediately
    verificationResult.classList.remove('hidden');
    verificationMessage.innerHTML = `
        <div class="verification-status">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Processing QR code...</span>
        </div>
    `;

    try {
        const imageData = await readFileAsDataURL(file);
        console.log('File read as data URL');
        const qrCode = await scanQRCodeFromImage(imageData);
        
        console.log('QR Code Data:', qrCode);
        
        if (qrCode) {
            try {
                // Send the encrypted data to the server for decryption
                const response = await fetch(`${API_BASE_URL}/attendance/decrypt-qr`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        encryptedData: qrCode,
                        courseName: selectedCourse
                    })
                });

                const data = await response.json();
                
                if (response.ok) {
                    verificationMessage.innerHTML = `
                        <div class="student-info">
                            <p><strong>QR Code Data:</strong></p>
                            <p><strong>Student ID:</strong> ${data.student.studentId}</p>
                            <p><strong>Full name:</strong> ${data.student.name}</p>
                            <p><strong>Course:</strong> ${data.student.course}</p>
                        </div>
                        <div class="verification-status success">
                            <i class="fa-solid fa-check-circle"></i>
                            <span>QR Code is valid</span>
                        </div>
                    `;
                } else {
                    throw new Error(data.error || 'Verification failed');
                }
            } catch (error) {
                console.error('Error processing QR data:', error);
                verificationMessage.innerHTML = `
                    <div class="verification-status error">
                        <i class="fa-solid fa-exclamation-circle"></i>
                        <span>Error processing QR code</span>
                    </div>
                    <div class="verification-help">
                        <p>Please make sure you're using a valid QR code generated by this system.</p>
                    </div>
                `;
            }
        } else {
            verificationMessage.innerHTML = `
                <div class="verification-status error">
                    <i class="fa-solid fa-exclamation-circle"></i>
                    <span>No QR code found in the image</span>
                </div>
                <div class="verification-help">
                    <p>Please try again with a clearer image of your QR code.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('QR verification error:', error);
        verificationMessage.innerHTML = `
            <div class="verification-status error">
                <i class="fa-solid fa-exclamation-circle"></i>
                <span>Error verifying QR code</span>
            </div>
            <div class="verification-help">
                <p>Please try again with a valid QR code image.</p>
            </div>
        `;
    }
});

// Helper function to read file as data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Helper function to scan QR code from image
function scanQRCodeFromImage(imageData) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded successfully');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set canvas size to match QR code generation size
            canvas.width = 300;
            canvas.height = 300;
            
            // Draw image to canvas, maintaining aspect ratio
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            context.drawImage(img, x, y, img.width * scale, img.height * scale);
            
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            console.log('Image dimensions:', canvas.width, 'x', canvas.height);
            
            // Use same settings as QR code generation
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
                canOverwriteImage: false
            });
            
            if (code) {
                console.log('QR code found:', code);
            } else {
                console.log('No QR code found in image');
            }
            
            resolve(code ? code.data : null);
        };
        img.onerror = (error) => {
            console.error('Error loading image:', error);
            resolve(null);
        };
        img.src = imageData;
    });
}

// Reset verification
newVerifyBtn.addEventListener('click', () => {
    // Hide verification result
    verificationResult.classList.add('hidden');
    // Clear file input
    qrFile.value = '';
    
    // Show initial elements
    document.querySelector('#verify .form-group').classList.remove('hidden');
    document.querySelector('.decrypt-options').classList.remove('hidden');
});

// Load courses when page loads
loadCoursesForVerification();

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
        alertPopup('Failed to load courses. Please try again later.');
        return [];
    }
}

// Function to populate select elements with courses
async function populateCourseSelects() {
    const selects = [
        'registerCourse',
        'qrCourse',
        'verifyCourse',
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
            select.innerHTML += '<option value="" disabled>Loading courses...</option>';
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
                defaultOption.textContent = selectId === 'filterCourse' ? 'All Courses' : 'Select your course';
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

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    populateCourseSelects();
});