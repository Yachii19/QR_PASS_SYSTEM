 import alertPopup from "./utils/alert.js";

 // API base URL
 const API_BASE_URL = 'http://localhost:4000/api';
 let adminToken = null;
 let currentEditingCourseId = null;

 // Check for existing token in sessionStorage
 document.addEventListener('DOMContentLoaded', () => {
     const token = sessionStorage.getItem('adminToken');
     if (token) {
         adminToken = token;
         showDashboard();
         loadAdminCourses();
         loadCoursesForFilter();
         fetchAttendances();
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
             
             data.courses.forEach(course => {
                 const row = document.createElement('tr');
                 row.innerHTML = `
                     <td>${course.name}</td>
                     <td>${new Date(course.createdAt).toLocaleDateString()}</td>
                     <td>
                         <button class="primary-btn edit-course-btn" data-id="${course.id}" data-name="${course.name}" data-key="${course.encryptionKey}">Edit</button>
                         <button class="danger-btn delete-course-btn" data-id="${course.id}" data-name="${course.name}">Delete</button>
                     </td>
                 `;
                 tbody.appendChild(row);
             });
             
             // Add event listeners to edit and delete buttons
             document.querySelectorAll('.edit-course-btn').forEach(btn => {
                 btn.addEventListener('click', showEditCourseModal);
             });
             
             document.querySelectorAll('.delete-course-btn').forEach(btn => {
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
             // Clear existing options except the first one
             while (courseSelect.options.length > 1) {
                 courseSelect.remove(1);
             }
             
             // Add courses from backend
             data.courses.forEach(course => {
                 const option = document.createElement('option');
                 option.value = course.name;
                 option.textContent = course.name;
                 courseSelect.appendChild(option);
             });
         } else {
             throw new Error(data.error || 'Failed to load courses');
         }
     } catch (error) {
         console.error('Load courses for filter error:', error);
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

 // Replace your existing showEditCourseModal function with this:
 function showEditCourseModal(e) {
    const courseId = e.target.dataset.id;
    const courseName = e.target.dataset.name;
    const courseKey = e.target.dataset.key;
    
    currentEditingCourseId = courseId;
    document.getElementById('editCourseName').value = courseName;
    document.getElementById('editCourseKey').value = courseKey;
    
    // Show the modal with similar behavior to alertPopup
    const modal = document.getElementById('editCourseModal');
    document.body.classList.add("modal-open");
    modal.style.display = "flex";
    modal.classList.remove('hidden');
    document.getElementById('editCourseStatus').classList.add('hidden');
    
    // Close modal when clicking outside content
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeEditModal();
        }
    });
    
    // Close with escape key
    document.addEventListener('keydown', handleEscapeKey);
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

//  save edit course
 document.getElementById('saveCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('editCourseName').value.trim();
    const key = document.getElementById('editCourseKey').value.trim();
    const statusElement = document.getElementById('editCourseStatus');
    
    if (!name || !key) {
        showStatusMessage('editCourseStatus', 'Both course name and encryption key are required', false);
        return;
    }
    
    if (key.length < 16) {
        showStatusMessage('editCourseStatus', 'Encryption key must be at least 16 characters', false);
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
            showStatusMessage('editCourseStatus', 'Course updated successfully', true);
            setTimeout(() => {
                closeEditModal();
                loadAdminCourses();
                loadCoursesForFilter();
            }, 1500);
        } else {
            throw new Error(data.error || 'Failed to update course');
        }
    } catch (error) {
        console.error('Update course error:', error);
        showStatusMessage('editCourseStatus', error.message || 'Failed to update course', false);
    }
});

 // Confirm and delete course
 function confirmDeleteCourse(e) {
     const courseId = e.target.dataset.id;
     const courseName = e.target.dataset.name;
     
     if (confirm(`Are you sure you want to delete the course "${courseName}"?`)) {
         deleteCourse(courseId);
     }
 }

 // Delete course
 async function deleteCourse(courseId) {
     try {
         const response = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
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
 }

 // Fetch attendance records
 async function fetchAttendances() {
     const date = document.getElementById('filterDate').value;
     const course = document.getElementById('filterCourse').value;
     
     try {
         let url = `${API_BASE_URL}/attendance/`;
         if (date) url += `date=${date}&`;
         if (course) url += `course=${encodeURIComponent(course)}`;
         
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
                 return;
             }
             
             data.attendances.forEach(att => {
                 const row = document.createElement('tr');
                 row.innerHTML = `
                     <td>${att.studentId}</td>
                     <td>${att.studentName}</td>
                     <td>${att.course}</td>
                     <td>${new Date(att.timeIn).toLocaleTimeString()}</td>
                     <td>${att.timeOut ? new Date(att.timeOut).toLocaleTimeString() : 'N/A'}</td>
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

 // Helper function to show status messages
 function showStatusMessage(elementId, message, isSuccess) {
     const element = document.getElementById(elementId);
     element.textContent = message;
     element.classList.remove('hidden', 'success-message', 'error-message');
     element.classList.add(isSuccess ? 'success-message' : 'error-message');
     
     // Auto-hide after 5 seconds
     setTimeout(() => {
         element.classList.add('hidden');
     }, 5000);
 }

 // Filter button
 document.getElementById('filterBtn').addEventListener('click', fetchAttendances);