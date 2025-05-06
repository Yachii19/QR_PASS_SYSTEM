const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  student_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    required: [true, 'Student reference is required']
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course reference is required']
  },
  name: { 
    type: String, 
    required: [true, 'Parent name is required'],
    trim: true,
    maxlength: [100, 'Parent name cannot exceed 100 characters']
  },
  relation: { 
    type: String, 
    required: [true, 'Relation is required'],
    enum: {
      values: ['Father', 'Mother', 'Guardian'],
      message: 'Relation must be Father, Mother, or Guardian'
    }
  },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Parent', parentSchema);