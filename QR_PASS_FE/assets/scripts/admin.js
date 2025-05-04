import alertPopup from "./utils/alert.js";

// API base URL
const API_BASE_URL = 'http://localhost:4000/api';
let adminToken = null;
let currentEditingCourseId = null;
let currentDeletingCourseId = null;
let currentDeletingCourseName = null;

// Pagination variables
const ITEMS_PER_PAGE = 10;
let currentCoursePage = 1;
let currentAttendancePage = 1;
let totalCoursePages = 1;
let totalAttendancePages = 1;

// Check for existing token in sessionStorage
document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        adminToken = token;
        showDashboard();
        loadAdminCourses();
        loadCoursesForFilter();
        fetchAttendances();
        initializeTableDrag();
    }
});

// Admin login
document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);

async function adminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const loginStatus = document.getElementById('adminLoginStatus');
    
    if (!username || !password) {
        loginStatus.textContent = 'Please enter both username and password';
        loginStatus.classList.remove('hidden');
        return;
    }
    
    const loginBtn = document.getElementById('adminLoginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    loginStatus.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.token;
            sessionStorage.setItem('adminToken', adminToken);
            showDashboard();
            await loadAdminCourses();
            await loadCoursesForFilter();
            await fetchAttendances();
        } else {
            loginStatus.textContent = data.error || 'Login failed';
            loginStatus.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        loginStatus.textContent = 'Login failed. Please try again.';
        loginStatus.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

function showDashboard() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    adminToken = null;
    sessionStorage.removeItem('adminToken');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
});

// Load courses for management table
async function loadAdminCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses/full`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const tbody = document.getElementById('coursesTableBody');
            tbody.innerHTML = '';
            
            if (data.courses.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="3" class="no-records">No courses found</td>';
                tbody.appendChild(row);
                return;
            }

            // Calculate total pages
            totalCoursePages = Math.ceil(data.courses.length / ITEMS_PER_PAGE);
            updateCoursePagination();

            // Get current page items
            const startIndex = (currentCoursePage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentPageItems = data.courses.slice(startIndex, endIndex);
            
            currentPageItems.forEach(course => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${course.name}</td>
                    <td>${new Date(course.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="icon-btn edit-btn" data-id="${course.id}" data-name="${course.name}" data-key="${course.encryptionKey}" title="Edit Course">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="icon-btn delete-btn" data-id="${course.id}" data-name="${course.name}" title="Delete Course">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Add event listeners to edit and delete buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', showEditCourseModal);
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', confirmDeleteCourse);
            });
        } else {
            throw new Error(data.error || 'Failed to load courses');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load courses', false);
    }
}

// Update course pagination UI
function updateCoursePagination() {
    const prevBtn = document.getElementById('prevCoursePage');
    const nextBtn = document.getElementById('nextCoursePage');
    const pageInfo = document.getElementById('coursePageInfo');

    prevBtn.disabled = currentCoursePage === 1;
    nextBtn.disabled = currentCoursePage === totalCoursePages;
    pageInfo.textContent = `Page ${currentCoursePage} of ${totalCoursePages}`;
}

// Course pagination event listeners
document.getElementById('prevCoursePage').addEventListener('click', () => {
    if (currentCoursePage > 1) {
        currentCoursePage--;
        loadAdminCourses();
    }
});

document.getElementById('nextCoursePage').addEventListener('click', () => {
    if (currentCoursePage < totalCoursePages) {
        currentCoursePage++;
        loadAdminCourses();
    }
});

// Load courses for filter dropdown
async function loadCoursesForFilter() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses/full`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const courseSelect = document.getElementById('filterCourse');
            const verifyCourseSelect = document.getElementById('verifyCourse');
            
            // Clear existing options except the first one
            while (courseSelect.options.length > 1) {
                courseSelect.remove(1);
            }
            while (verifyCourseSelect.options.length > 1) {
                verifyCourseSelect.remove(1);
            }
            
            // Add courses from backend
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.name;
                option.textContent = course.name;
                courseSelect.appendChild(option);
                
                const verifyOption = document.createElement('option');
                verifyOption.value = course.name;
                verifyOption.textContent = course.name;
                verifyCourseSelect.appendChild(verifyOption);
            });
        } else {
            throw new Error(data.error || 'Failed to load courses');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load courses', false);
    }
}

// Add new course
document.getElementById('addCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('courseName').value.trim();
    const key = document.getElementById('courseKey').value.trim();
    
    if (!name || !key) {
        showStatusMessage('courseStatus', 'Both course name and encryption key are required', false);
        return;
    }
    
    if (key.length < 16) {
        showStatusMessage('courseStatus', 'Encryption key must be at least 16 characters', false);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, encryptionKey: key })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course added successfully', true);
            document.getElementById('courseName').value = '';
            document.getElementById('courseKey').value = '';
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to add course');
        }
    } catch (error) {
        console.error('Add course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to add course', false);
    }
});

// Show edit course modal
function showEditCourseModal(e) {
    // Get data from the button's dataset
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;
    
    const courseId = btn.dataset.id;
    const courseName = btn.dataset.name;
    const courseKey = btn.dataset.key;
    
    // Validate data
    if (!courseId || !courseName || !courseKey) {
        console.error('Missing course data:', { courseId, courseName, courseKey });
        return;
    }
    
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
    
    // Set data after a brief delay
    setTimeout(() => {
        try {
            currentEditingCourseId = courseId;
            document.getElementById('editCourseName').value = courseName;
            document.getElementById('editCourseKey').value = courseKey;
            document.getElementById('editCourseStatus').classList.add('hidden');
            
            // Show modal
            const modal = document.getElementById('editCourseModal');
            document.body.classList.add("modal-open");
            modal.style.display = "flex";
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing edit modal:', error);
            showStatusMessage('courseStatus', 'Error loading course data', false);
        } finally {
            // Remove loading overlay
            loadingOverlay.remove();
        }
    }, 300);
}

function closeEditModal() {
    const modal = document.getElementById('editCourseModal');
    document.body.classList.remove("modal-open");
    modal.style.display = "none";
    modal.classList.add('hidden');
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeEditModal();
    }
}

// Close modal when clicking outside the modal content
document.getElementById('editCourseModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editCourseModal')) {
        document.getElementById('editCourseModal').classList.add('hidden');
    }
});

// Close modal with cancel button
// Update your cancel button event listener
document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
document.querySelector('.close-modal').addEventListener('click', closeEditModal);

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    document.getElementById('editCourseModal').classList.add('hidden');
});

// Save edit course
document.getElementById('saveCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('editCourseName').value.trim();
    const key = document.getElementById('editCourseKey').value.trim();
    
    if (!name || !key) {
        showStatusMessage('courseStatus', 'Both course name and encryption key are required', false);
        return;
    }
    
    if (key.length < 16) {
        showStatusMessage('courseStatus', 'Encryption key must be at least 16 characters', false);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses/${currentEditingCourseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, encryptionKey: key })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course updated successfully', true);
            closeEditModal();
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to update course');
        }
    } catch (error) {
        console.error('Update course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to update course', false);
    }
});

// Show delete course modal
function showDeleteCourseModal(e) {
    // Get data from the button's dataset
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    
    const courseId = btn.dataset.id;
    const courseName = btn.dataset.name;
    
    // Validate data
    if (!courseId || !courseName) {
        console.error('Missing course data:', { courseId, courseName });
        return;
    }
    
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
    
    // Set data after a brief delay
    setTimeout(() => {
        try {
            currentDeletingCourseId = courseId;
            currentDeletingCourseName = courseName;
            const message = document.getElementById('deleteCourseMessage');
            message.textContent = `Are you sure you want to delete the course "${courseName}"?`;
            document.getElementById('deleteCourseStatus').classList.add('hidden');
            
            // Show modal
            const modal = document.getElementById('deleteCourseModal');
            document.body.classList.add("modal-open");
            modal.style.display = "flex";
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing delete modal:', error);
            showStatusMessage('courseStatus', 'Error loading course data', false);
        } finally {
            // Remove loading overlay
            loadingOverlay.remove();
        }
    }, 300);
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteCourseModal');
    document.body.classList.remove("modal-open");
    modal.style.display = "none";
    modal.classList.add('hidden');
    document.removeEventListener('keydown', handleDeleteEscapeKey);
}

function handleDeleteEscapeKey(e) {
    if (e.key === 'Escape') {
        closeDeleteModal();
    }
}

// Close delete modal with cancel button
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);

// Close delete modal with X button
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        if (document.getElementById('deleteCourseModal').classList.contains('hidden')) {
            closeEditModal();
        } else {
            closeDeleteModal();
        }
    });
});

// Delete course
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!currentDeletingCourseId) return;
    
    // Close modal immediately
    closeDeleteModal();
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses/${currentDeletingCourseId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course deleted successfully', true);
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to delete course');
        }
    } catch (error) {
        console.error('Delete course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to delete course', false);
    }
});

// Update the delete button click handler
function confirmDeleteCourse(e) {
    showDeleteCourseModal(e);
}

// Filter button
document.getElementById('filterBtn').addEventListener('click', () => {
    currentAttendancePage = 1; // Reset to first page when filtering
    fetchAttendances();
});

// Fetch attendance records with pagination
async function fetchAttendances() {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    try {
        let url = `${API_BASE_URL}/attendance/`;
        const params = new URLSearchParams();
        
        if (date) params.append('date', date);
        if (course) params.append('course', course);
        
        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const tbody = document.querySelector('#attendanceTable tbody');
            tbody.innerHTML = '';
            
            if (data.attendances.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="6" class="no-records">No attendance records found</td>';
                tbody.appendChild(row);
                updateAttendancePagination();
                return;
            }

            // Calculate total pages
            totalAttendancePages = Math.ceil(data.attendances.length / ITEMS_PER_PAGE);
            updateAttendancePagination();

            // Get current page items
            const startIndex = (currentAttendancePage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentPageItems = data.attendances.slice(startIndex, endIndex);
            
            currentPageItems.forEach(att => {
                const row = document.createElement('tr');
                const timeOut = att.timeOut ? new Date(att.timeOut).toLocaleTimeString() : 'N/A';
                
                // Add class based on time out status
                if (timeOut === 'N/A') {
                    row.classList.add('present');
                } else {
                    row.classList.add('absent');
                }
                
                row.innerHTML = `
                    <td>${att.studentId}</td>
                    <td>${att.studentName}</td>
                    <td>${att.course}</td>
                    <td>${new Date(att.timeIn).toLocaleTimeString()}</td>
                    <td>${timeOut}</td>
                    <td>${new Date(att.date).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            throw new Error(data.error || 'Failed to fetch attendances');
        }
    } catch (error) {
        console.error('Fetch attendances error:', error);
        alertPopup('Failed to fetch attendance records');
    }
}

// Update attendance pagination UI
function updateAttendancePagination() {
    const prevBtn = document.getElementById('prevAttendancePage');
    const nextBtn = document.getElementById('nextAttendancePage');
    const pageInfo = document.getElementById('attendancePageInfo');

    prevBtn.disabled = currentAttendancePage === 1;
    nextBtn.disabled = currentAttendancePage === totalAttendancePages || totalAttendancePages === 0;
    pageInfo.textContent = totalAttendancePages > 0 ? `Page ${currentAttendancePage} of ${totalAttendancePages}` : 'No records';
}

// Attendance pagination event listeners
document.getElementById('prevAttendancePage').addEventListener('click', () => {
    if (currentAttendancePage > 1) {
        currentAttendancePage--;
        fetchAttendances();
    }
});

document.getElementById('nextAttendancePage').addEventListener('click', () => {
    if (currentAttendancePage < totalAttendancePages) {
        currentAttendancePage++;
        fetchAttendances();
    }
});

// Reset pagination when switching tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'course-management') {
            currentCoursePage = 1;
            loadAdminCourses();
        } else if (tab.dataset.tab === 'attendance-records') {
            currentAttendancePage = 1;
            fetchAttendances();
        }
    });
});

// Helper function to show status messages
function showStatusMessage(elementId, message, isSuccess) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Status message element not found: ${elementId}`);
        return;
    }
    
    // Ensure message is a string and not undefined
    const displayMessage = typeof message === 'string' ? message : 'An error occurred';
    
    element.textContent = displayMessage;
    element.classList.remove('hidden', 'success-message', 'error-message');
    element.classList.add(isSuccess ? 'success-message' : 'error-message');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

// Password toggle functionality
const togglePassword = document.querySelector('.toggle-password');
const passwordInput = document.getElementById('adminPassword');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Toggle eye icon
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        // Stop scanner if switching away from verify tab
        if (tab.dataset.tab !== 'verify' && window.scannerStream) {
            stopScanner();
        }
    });
});

// Table horizontal drag functionality
function initializeTableDrag() {
    const tableContainer = document.querySelector('.table-container');
    let isDown = false;
    let startX;
    let scrollLeft;

    tableContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        tableContainer.classList.add('grabbing');
        startX = e.pageX - tableContainer.offsetLeft;
        scrollLeft = tableContainer.scrollLeft;
    });

    tableContainer.addEventListener('mouseleave', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mouseup', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - tableContainer.offsetLeft;
        const walk = (x - startX) * 2;
        tableContainer.scrollLeft = scrollLeft - walk;
    });

    // Touch events for mobile
    tableContainer.addEventListener('touchstart', (e) => {
        isDown = true;
        tableContainer.classList.add('grabbing');
        startX = e.touches[0].pageX - tableContainer.offsetLeft;
        scrollLeft = tableContainer.scrollLeft;
    });

    tableContainer.addEventListener('touchend', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - tableContainer.offsetLeft;
        const walk = (x - startX) * 2;
        tableContainer.scrollLeft = scrollLeft - walk;
    });
}

// QR Verification
let scannerActive = false;
document.getElementById('scanBtn').addEventListener('click', startScanner);
document.getElementById('stopScanBtn').addEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').addEventListener('click', resetVerification);

async function verifyQRCode(encryptedData) {
    const course = document.getElementById('verifyCourse').value;
    
    if (!course) {
        alertPopup('Please select a course');
        return;
    }
    
    const verifyBtn = document.querySelector('.scan-btn');
    const originalBtnText = verifyBtn?.textContent;
    
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/verify-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                encryptedData,
                courseName: course,
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
            const timeInAndOutMessage = document.createElement('h3');
            timeInAndOutMessage.innerHTML = `${data.message}`;
            timeInAndOutMessage.className = data.action === 'time_in' ? 'success-message' : 'info-message';
            resultDiv.appendChild(timeInAndOutMessage);
            
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
    document.getElementById('verificationResult').classList.add('hidden');
    document.getElementById('verificationMessage').innerHTML = '';
    document.getElementById('verifyCourse').value = '';
}

// Add CSS for loading overlay
const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);