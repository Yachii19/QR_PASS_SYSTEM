const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student'
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent'
  },
  time_in: { 
    type: Date,
    required: [true, 'Time in is required']
  },
  time_out: { type: Date },
  date_in: { 
    type: Date,
    required: [true, 'Date in is required']
  }
}, { 
  timestamps: true 
});

// Add validation to ensure either student or parent is present
attendanceSchema.pre('validate', function(next) {
  if (!this.student_id && !this.parent_id) {
    this.invalidate('student_id', 'Either student or parent must be provided');
    this.invalidate('parent_id', 'Either student or parent must be provided');
  }
  next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);