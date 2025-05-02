import alertPopup from "./utils/alert.js";

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        if (tab.dataset.tab !== 'verify' && window.scannerStream) {
            stopScanner();
        }
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
            // Clear previous QR code
            const canvas = document.getElementById('qrCodeCanvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set canvas size explicitly
            canvas.width = 300;
            canvas.height = 300;
            
            // Generate QR code directly to canvas
            QRCode.toCanvas(canvas, data.encryptedData, {
                width: 250,  // Slightly smaller than canvas to ensure border
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

// QR Download
function downloadQRCode() {
const canvas = document.getElementById('qrCodeCanvas');
if (!canvas) return;

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
link.download = 'graduation-pass.png';
link.href = tempCanvas.toDataURL('image/png');
link.click();
}

// QR Verification
let scannerActive = false;
document.getElementById('scanBtn').addEventListener('click', startScanner);
document.getElementById('stopScanBtn').addEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').addEventListener('click', resetVerification);


// Updated verifyQRCode function in the frontend
async function verifyQRCode(encryptedData) {
    const course = document.getElementById('verifyCourse').value;
    const userProvidedKey = document.getElementById('encryptionKey').value.trim();
    
    if (!course || !userProvidedKey) {
        alertPopup('Please select the course and enter the encryption key');
        return;
    }
    
    const verifyBtn = document.getElementById('processImageBtn') || document.querySelector('.scan-btn');
    const originalBtnText = verifyBtn.textContent;
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/verify-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                encryptedData,
                courseName: course,
                userProvidedKey
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.log(data);
            throw new Error(data.error || 'Verification failed');
        }

        // Display verification result
        const resultDiv = document.getElementById('verificationMessage');
        resultDiv.innerHTML = '';
        
        if (data.success) {
            // Create student info section
            const studentInfo = document.createElement('div');
            studentInfo.className = 'student-info';
            studentInfo.innerHTML = `
                <p><strong>Student ID:</strong> ${data.student.studentId}</p>
                <p><strong>Name:</strong> ${data.student.name}</p>
                <p><strong>Course:</strong> ${data.student.course}</p>
            `;
            resultDiv.appendChild(studentInfo);
            
            // Create status message
            const statusMsg = document.createElement('p');
            statusMsg.className = data.action === 'time_in' ? 'success-message' : 'info-message';
            statusMsg.innerHTML = `✅ ${data.message}`;
            resultDiv.appendChild(statusMsg);
            
            // Add time records
            const timeIn = document.createElement('p');
            timeIn.innerHTML = `<strong>Time In:</strong> ${new Date(data.time_in).toLocaleString()}`;
            resultDiv.appendChild(timeIn);
            
            if (data.time_out) {
                const timeOut = document.createElement('p');
                timeOut.innerHTML = `<strong>Time Out:</strong> ${new Date(data.time_out).toLocaleString()}`;
                resultDiv.appendChild(timeOut);
            }
            
            // Add verification timestamp
            const verifyTime = document.createElement('p');
            verifyTime.className = 'verify-time';
            verifyTime.innerHTML = `<em>Verified at: ${new Date().toLocaleString()}</em>`;
            resultDiv.appendChild(verifyTime);
        }
        
        document.getElementById('verificationResult').classList.remove('hidden');
        
    } catch (error) {
        console.error('Verification error:', error);
        const resultDiv = document.getElementById('verificationMessage');
        resultDiv.innerHTML = `
            <p class="error-message">${error.message}</p>
            <div class="verification-help">
                <p><strong>Possible solutions:</strong></p>
                <ul>
                    <li>Ensure you selected the correct course</li>
                    <li>Check that the encryption key is correct</li>
                    <li>Make sure the QR code hasn't been tampered with</li>
                    <li>Try scanning again in better lighting conditions</li>
                </ul>
            </div>
        `;
        document.getElementById('verificationResult').classList.remove('hidden');
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = originalBtnText;
        }
    }
}


// Enhanced QR scanning function
function startScanner() {
    const course = document.getElementById('verifyCourse').value;
    if (!course) {
        alertPopup('Please select the course first');
        return;
    }
    
    // UI Updates
    document.getElementById('scanBtn').classList.add('hidden');
    document.getElementById('stopScanBtn').classList.remove('hidden');
    document.getElementById('scannerContainer').classList.remove('hidden');
    document.getElementById('verificationResult').classList.add('hidden');
    
    const video = document.getElementById('scanner');
    const cameraStatus = document.getElementById('cameraStatus');
    cameraStatus.textContent = 'Initializing camera...';
    cameraStatus.className = '';
    
    // Stop any existing stream
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => track.stop());
    }
    
    // Start new stream with better constraints
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    })
    .then(stream => {
        window.scannerStream = stream;
        video.srcObject = stream;
        video.play();
        scannerActive = true;
        
        // Improved camera status handling
        video.onplaying = () => {
            cameraStatus.textContent = 'Scanning for QR codes...';
            cameraStatus.className = 'scanning-status';
        };
        
        // Initialize QR code scanner with better configuration
        const canvasElement = document.createElement('canvas');
        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
        let lastScanTime = 0;
        
        function scanFrame() {
            if (!scannerActive) return;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // Throttle scanning to 300ms to reduce CPU usage
                const now = Date.now();
                if (now - lastScanTime < 300) {
                    requestAnimationFrame(scanFrame);
                    return;
                }
                lastScanTime = now;
                
                // Set canvas dimensions to match video
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                
                // Draw video frame to canvas
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                
                // Get image data and scan for QR codes
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                    canOverwriteImage: false
                });
                
                if (code) {
                    cameraStatus.textContent = 'QR code detected!';
                    cameraStatus.className = 'success-message';
                    
                    // Add slight delay for user feedback
                    setTimeout(() => {
                        verifyQRCode(code.data);
                        stopScanner();
                    }, 500);
                    return;
                }
            }
            requestAnimationFrame(scanFrame);
        }
        
        scanFrame();
    })
    .catch(err => {
        console.error('Camera error:', err);
        cameraStatus.textContent = 'Camera access denied or not available';
        cameraStatus.className = 'error-message';
        
        // Provide alternative instructions
        const helpText = document.createElement('p');
        helpText.className = 'camera-help';
        helpText.textContent = 'Please ensure camera permissions are granted and try again.';
        cameraStatus.appendChild(helpText);
        
        stopScanner();
    });
}

// Stop Scanner
function stopScanner() {
    scannerActive = false;
    document.getElementById('scanBtn').classList.remove('hidden');
    document.getElementById('stopScanBtn').classList.add('hidden');
    document.getElementById('scannerContainer').classList.add('hidden');
    document.getElementById('cameraStatus').textContent = '';
    
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => track.stop());
        window.scannerStream = null;
    }
}

function resetVerification() {
    stopScanner();
    document.getElementById('verificationResult').classList.add('hidden');
    document.getElementById('fileInput').value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imageProcessing').classList.add('hidden');
    document.querySelector('.img-box').classList.remove('hidden');
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