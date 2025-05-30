import alertPopup from "./utils/alert.js";


// API base URL
const API_BASE_URL = 'https://qr-pass-system-iakb.onrender.com/api';
// const API_BASE_URL = 'http://localhost:4000/api';

let adminToken = null;
let currentEditingCourseId = null;
let currentDeletingCourseId = null;
let currentDeletingCourseName = null;
let attendanceChart = null;

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
        loadCurrentAttendances();
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
                row.innerHTML = '<td colspan="3" class="no-records">No programs found</td>';
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
            throw new Error(data.error || 'Failed to load programs');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load programs', false);
    }
}

// Generate random encryption key
document.getElementById('generateKeyBtn').addEventListener('click', generateRandomKey);

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let key = '';
    
    // Generate a 32-character key (you can adjust length as needed)
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    document.getElementById('courseKey').value = key;
    
    // Show a brief success message
    const keyInputContainer = document.querySelector('.key-input-container');
    const successMsg = document.createElement('div');
    successMsg.className = 'key-success-message';
    successMsg.innerHTML = '<i class="fa-solid fa-check"></i> Key generated';
    keyInputContainer.appendChild(successMsg);
    
    // Remove the message after 2 seconds
    setTimeout(() => {
        successMsg.remove();
    }, 2000);
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
            throw new Error(data.error || 'Failed to load programs');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load programs', false);
    }
}

// Add new course
document.getElementById('addCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('courseName').value.trim();
    const key = document.getElementById('courseKey').value.trim();
    
    if (!name || !key) {
        showStatusMessage('courseStatus', 'Both program name and encryption key are required', false);
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
            throw new Error(data.error || 'Failed to add program');
        }
    } catch (error) {
        console.error('Add course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to add program', false);
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
            showStatusMessage('courseStatus', 'Error loading program data', false);
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
        showStatusMessage('courseStatus', 'Both program name and encryption key are required', false);
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
            showStatusMessage('courseStatus', 'Program updated successfully', true);
            closeEditModal();
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to update program');
        }
    } catch (error) {
        console.error('Update course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to update program', false);
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
            message.textContent = `Are you sure you want to delete the program "${courseName}"?`;
            document.getElementById('deleteCourseStatus').classList.add('hidden');
            
            // Show modal
            const modal = document.getElementById('deleteCourseModal');
            document.body.classList.add("modal-open");
            modal.style.display = "flex";
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing delete modal:', error);
            showStatusMessage('courseStatus', 'Error loading program data', false);
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
            showStatusMessage('courseStatus', 'Program deleted successfully', true);
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to delete program');
        }
    } catch (error) {
        console.error('Delete course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to delete program', false);
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
          
                // Handle student or parent attendance
                if (att.parent) {
                    row.innerHTML = `
                        <td>${att.parent.studentId} (${att.parent.relation})</td>
                        <td>${att.parent.parentName}</td>
                        <td>${att.parent.course}</td>
                        <td>${new Date(att.timeIn).toLocaleTimeString()}</td>
                        <td>${timeOut}</td>
                        <td>${new Date(att.date).toLocaleDateString()}</td>
                        <td>
                            <button class="icon-btn delete-btn" data-id="${att.id}" title="Delete Attendance">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                        </td>
                       
                    `;
                } else if (att.student) {
                    row.innerHTML = `
                        <td>${att.student.studentId}</td>
                        <td>${att.student.studentName}</td>
                        <td>${att.student.course}</td>
                        <td>${new Date(att.timeIn).toLocaleTimeString()}</td>
                        <td>${timeOut}</td>
                        <td>${new Date(att.date).toLocaleDateString()}</td>
                         td>
                            <button class="icon-btn delete-btn" data-id="${att.id}" title="Delete Attendance">
                                            <i class="fa-solid fa-trash"></i>
                                        </button>
                        </td>
                    `;
                } else {
                    row.innerHTML = `
                        <td colspan="6" class="no-records">Invalid attendance record</td>
                    `;
                }
                
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
        } else if (tab.dataset.tab === 'current-attendance') {
            loadCurrentAttendances();
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
let scanAnimationFrame = null;

document.getElementById('scanBtn').addEventListener('click', startScanner);
document.getElementById('stopScanBtn').addEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').addEventListener('click', resetVerification);

async function verifyQRCode(encryptedData) {
    const course = document.getElementById('verifyCourse').value;
    
    if (!course) {
        alertPopup('Please select a Program');
        return;
    }
    
    const verifyBtn = document.querySelector('.scan-btn');
    const originalBtnText = verifyBtn?.textContent;
    
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }

    try {
        console.log('Sending request with:', {
            encryptedData,
            courseName: course
        });

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
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed');
        }

        // Display verification result
        const resultDiv = document.getElementById('verificationMessage');
        resultDiv.innerHTML = '';

        if (data.success) {
            if (data.student) {
                // Handle student QR code
                const studentInfo = document.createElement('div');
                studentInfo.className = 'student-info';
                studentInfo.innerHTML = `
                    <p><strong>Student ID:</strong> ${data.student.studentId}</p>
                    <p><strong>Name:</strong> ${data.student.name}</p>
                    <p><strong>Course:</strong> ${data.student.course}</p>
                `;
                resultDiv.appendChild(studentInfo);
            } else if (data.parent) {
                // Handle parent QR code
                const parentInfo = document.createElement('div');
                parentInfo.className = 'parent-info';
                parentInfo.innerHTML = `
                    <p><strong>Parent Name:</strong> ${data.parent.name}</p>
                    <p><strong>Relation:</strong> ${data.parent.relation}</p>
                    <p><strong>Student ID:</strong> ${data.parent.studentId}</p>
                    <p><strong>Student Name:</strong> ${data.parent.studentName}</p>
                    <p><strong>Course:</strong> ${data.parent.course}</p>
                `;
                resultDiv.appendChild(parentInfo);
            }

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
                    <li>Ensure you selected the correct Program</li>
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


// Remove duplicate event listeners if any
document.getElementById('scanBtn').removeEventListener('click', startScanner);
document.getElementById('stopScanBtn').removeEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').removeEventListener('click', resetVerification);

// Add fresh event listeners
document.getElementById('scanBtn').addEventListener('click', startScanner);
document.getElementById('stopScanBtn').addEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').addEventListener('click', resetVerification);

async function startScanner() {
     if (scannerActive) return;
    const course = document.getElementById('verifyCourse').value;
    if (!course) {
        alertPopup('Please select the program first');
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
        stopScanner();
    }
    
     try {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        window.scannerStream = stream;
        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play()
                    .then(resolve)
                    .catch(err => {
                        console.error('Video play error:', err);
                        cameraStatus.textContent = 'Failed to start camera';
                        cameraStatus.className = 'error-message';
                        stopScanner();
                    });
            };
        });
        
        scannerActive = true;
        cameraStatus.textContent = 'Scanning for QR codes...';
        cameraStatus.className = 'scanning-status';
        
        const canvasElement = document.createElement('canvas');
        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
        let lastScanTime = 0;
        let isProcessing = false; // Flag to prevent multiple processing
        
        function scanFrame() {
            if (!scannerActive) return;
            
            scanAnimationFrame = requestAnimationFrame(scanFrame);
            
            if (video.readyState === video.HAVE_ENOUGH_DATA && !isProcessing) {
                // Throttle scanning to reduce CPU usage
                const now = Date.now();
                if (now - lastScanTime < 300) return;
                lastScanTime = now;
                
                try {
                    isProcessing = true;
                    
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
                    }
                } catch (err) {
                    console.error('Scan error:', err);
                } finally {
                    isProcessing = false;
                }
            }
        }
        
        scanFrame();
    } catch (err) {
        console.error('Camera error:', err);
        
        if (err.name === 'NotAllowedError') {
            cameraStatus.textContent = 'Camera access denied. Please allow camera permissions.';
            cameraStatus.className = 'error-message';
            
            const helpText = document.createElement('div');
            helpText.className = 'camera-help';
            helpText.innerHTML = `
                <p>Android Chrome users:</p>
                <ol>
                    <li>Tap the lock icon in the address bar</li>
                    <li>Select "Site settings"</li>
                    <li>Ensure "Camera" is set to "Allow"</li>
                    <li>Refresh the page and try again</li>
                </ol>
            `;
            cameraStatus.appendChild(helpText);
        } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
            cameraStatus.textContent = 'No camera found or camera not supported';
            cameraStatus.className = 'error-message';
        } else {
            cameraStatus.textContent = 'Failed to access camera: ' + err.message;
            cameraStatus.className = 'error-message';
        }
        
        stopScanner();
    }
}

function stopScanner() {
    scannerActive = false;
    
    if (scanAnimationFrame) {
        cancelAnimationFrame(scanAnimationFrame);
        scanAnimationFrame = null;
    }
    
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => {
            track.stop();
        });
        window.scannerStream = null;
    }
    
    const video = document.getElementById('scanner');
    if (video) {
        video.srcObject = null;
    }
    
    document.getElementById('scanBtn').classList.remove('hidden');
    document.getElementById('stopScanBtn').classList.add('hidden');
    document.getElementById('scannerContainer').classList.add('hidden');
    document.getElementById('cameraStatus').textContent = '';
}

function resetVerification() {
    document.getElementById('verificationResult').classList.add('hidden');
    document.getElementById('verificationMessage').innerHTML = '';
    document.getElementById('verifyCourse').value = '';
}

// Clear attendance records
document.getElementById('clearAttendanceBtn').addEventListener('click', () => {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    // Create confirmation message based on filters
    let message = 'Are you sure you want to clear ALL attendance records?';
    
    if (date || course) {
        message = 'Are you sure you want to clear attendance records for ';
        if (date) message += `date: ${date}`;
        if (date && course) message += ' and ';
        if (course) message += `course: ${course}`;
        message += '?';
    }
    
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Confirm Clear Attendance</h2>
                <button class="close-modal">&times;</button>
            </div>
            <p>${message}</p>
            <p class="warning-text"><i class="fa-solid fa-triangle-exclamation"></i> This action cannot be undone!</p>
            <div class="modal-actions">
                <button id="confirmClearBtn" class="danger-btn">Clear Records</button>
                <button id="cancelClearBtn" class="primary-btn">Cancel</button>
            </div>
            <div id="clearStatus" class="status-message hidden"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.classList.add("modal-open");
    modal.style.display = "flex";
    
    // Close modal handlers
    const closeModal = () => {
        document.body.classList.remove("modal-open");
        modal.remove();
    };
    
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancelClearBtn').addEventListener('click', closeModal);
    
    // Handle outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Handle clear confirmation
    modal.querySelector('#confirmClearBtn').addEventListener('click', async () => {
        const clearBtn = modal.querySelector('#confirmClearBtn');
        const originalText = clearBtn.innerHTML;
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';
        
        const statusDiv = modal.querySelector('#clearStatus');
        
        try {
            const response = await fetch(`${API_BASE_URL}/attendance`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    date: document.getElementById('filterDate').value,
                    course: document.getElementById('filterCourse').value
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                statusDiv.textContent = data.message || 'Attendance records cleared successfully';
                statusDiv.className = 'status-message success-message';
                
                // Refresh attendance records after a short delay
                setTimeout(() => {
                    fetchAttendances();
                    closeModal();
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to clear attendance records');
            }
        } catch (error) {
            console.error('Clear attendance error:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'status-message error-message';
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = originalText;
        }
    });
});

// Download PDF button
document.getElementById('downloadPdfBtn').addEventListener('click', downloadAttendancePDF);

async function downloadAttendancePDF() {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    try {
        // Show loading state
        const downloadBtn = document.getElementById('downloadPdfBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
        
        // Build query parameters
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (course) params.append('course', course);
        
        // Make the request
        const response = await fetch(`${API_BASE_URL}/attendance/pdf?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate PDF');
        }
        
        // Create blob from response
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Set filename from content-disposition header or generate one
        let filename = 'Attendance_Records.pdf';
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) filename = filenameMatch[1];
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        a.remove();
        
    } catch (error) {
        console.error('PDF download error:', error);
        
        if (error.message.includes('No attendance records')) {
            // Show empty records modal
            const modal = document.getElementById('emptyRecordModal');
            modal.style.display = 'flex';
            document.body.classList.add("modal-open");
            
            // Close modal handler
            document.getElementById('closeEmptyModalBtn').addEventListener('click', () => {
                modal.style.display = 'none';
                document.body.classList.remove("modal-open");
            }, { once: true });
        } else {
            alertPopup(error.message || 'Failed to download PDF');
        }
    } finally {
        // Reset button state
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
        }
    }
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

async function loadCurrentAttendances() {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/current`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateCurrentAttendanceTable(data.attendances);
            updateAttendanceChart(data.attendances);
            
            
            // Update total users count
            document.getElementById('totalTimedInUsers').textContent = data.attendances.length;
            
            // Update last update time
            const now = new Date();
            document.getElementById('lastUpdateTime').textContent = now.toLocaleTimeString();
        } else {
            throw new Error(data.error || 'Failed to load current attendances');
        }
    } catch (error) {
        console.error('Load current attendances error:', error);
        alertPopup('Failed to load current attendance data');
    }
}

function updateCurrentAttendanceTable(attendances) {
    const tbody = document.querySelector('#currentAttendanceTable tbody');
    tbody.innerHTML = '';
    
    if (attendances.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="no-records">No currently timed-in users</td>';
        tbody.appendChild(row);
        return;
    }
    
    attendances.forEach(att => {
        const row = document.createElement('tr');
        const now = new Date();
        const timeIn = new Date(att.timeIn);
        const duration = formatDuration(now - timeIn);
        
        if (att.parent) {
            row.innerHTML = `
                <td>${att.parent.studentId} (${att.parent.relation})</td>
                <td>${att.parent.parentName}</td>
                <td>${att.parent.relation}</td>
                <td>${att.parent.course}</td>
                <td>${timeIn.toLocaleTimeString()}</td>
                <td>${duration}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${att.student.studentId}</td>
                <td>${att.student.studentName}</td>
                <td>Student</td>
                <td>${att.student.course}</td>
                <td>${timeIn.toLocaleTimeString()}</td>
                <td>${duration}</td>
             
                
            `;
        }
        
        tbody.appendChild(row);
    });
}

function updateAttendanceChart(attendances) {
    const ctx = document.getElementById('attendancePieChart').getContext('2d');
    
    // Group by program
    const programCounts = {};
    attendances.forEach(att => {
        const program = att.parent ? att.parent.course : att.student.course;
        programCounts[program] = (programCounts[program] || 0) + 1;
    });
    
    const programs = Object.keys(programCounts);
    const counts = Object.values(programCounts);
    
    // Generate colors for each program
    const backgroundColors = programs.map((_, i) => {
        const hue = (i * 137.508) % 360; // Golden angle approximation for distinct colors
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    // Destroy previous chart if it exists
    if (attendanceChart) {
        attendanceChart.destroy();
    }
    
    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: programs,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderRadius: 6,
                barThickness: 'flex',
                maxBarThickness: 35,
                minBarLength: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',  // Horizontal bar chart
            layout: {
                padding: {
                    left: 20,
                    right: 30,
                    top: 20,
                    bottom: 20
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            if (label.length > 30) {
                                return label.substring(0, 27) + '...';
                            }
                            return label;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false  // Hide legend since labels are on Y axis
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return [
                                `Total Users: ${value}`,
                                `Percentage: ${percentage}%`
                            ];
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart',
                onProgress: function(animation) {
                    // Add animation for bars growing
                },
                onComplete: function() {
                    // Optional: Add any post-animation effects
                }
            },
            hover: {
                mode: 'nearest',
                intersect: false,
                animationDuration: 200
            },
            barPercentage: 0.8,
            categoryPercentage: 0.9
        }
    });
}

function formatDuration(ms) {
    if (!ms || ms < 0) return 'N/A';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    
    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
}

// Add refresh button event listener
document.getElementById('refreshCurrentAttendance').addEventListener('click', async () => {
    const refreshBtn = document.getElementById('refreshCurrentAttendance');
    const originalHtml = refreshBtn.innerHTML;
    
    refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;
    
    try {
        await loadCurrentAttendances();
    } finally {
        refreshBtn.innerHTML = originalHtml;
        refreshBtn.disabled = false;
    }
});