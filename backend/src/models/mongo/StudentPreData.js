// ============================================================================
// MongoDB Model: StudentPreData (Student Pre-Registration Roster)
// Holds pre-loaded student roster uploaded by HOD / Admin via Master Data.
// Used for fast verification during public student self-registration:
// Matches FullName, Enrollment, and Batch before allowing account creation in PostgreSQL.
// ============================================================================

const mongoose = require('mongoose');

const StudentPreDataSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Student Full Name is required'],
      trim: true,
      index: true
    },
    enrollment: {
      type: String,
      required: [true, 'Enrollment Number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    batch: {
      type: String,
      required: [true, 'Academic Batch is required (e.g. 2022-2026)'],
      trim: true,
      default: '2022-2026'
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    semester: {
      type: Number,
      default: 5
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
      uppercase: true
    },
    department: {
      type: String,
      default: 'CSE',
      trim: true,
      uppercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    isRegistered: {
      type: Boolean,
      default: false,
      index: true
    },
    registeredAt: {
      type: Date
    },
    registeredUserId: {
      type: String
    },
    source: {
      type: String,
      default: 'MASTER_DATA'
    }
  },
  {
    timestamps: true,
    collection: 'student_predata'
  }
);

// Pre-validate hook to support alias field names (name -> fullName, enrollment_no -> enrollment)
StudentPreDataSchema.pre('validate', function (next) {
  if (!this.fullName && this.get('name')) {
    this.fullName = this.get('name');
  }
  if (!this.enrollment && this.get('enrollment_no')) {
    this.enrollment = this.get('enrollment_no');
  }
  next();
});

// Virtuals / aliases for compatibility with diverse payload formats
StudentPreDataSchema.virtual('FullName')
  .get(function () {
    return this.fullName;
  })
  .set(function (val) {
    this.fullName = val;
  });

StudentPreDataSchema.virtual('Enrollment')
  .get(function () {
    return this.enrollment;
  })
  .set(function (val) {
    this.enrollment = val;
  });

StudentPreDataSchema.virtual('Batch')
  .get(function () {
    return this.batch;
  })
  .set(function (val) {
    this.batch = val;
  });

StudentPreDataSchema.virtual('name')
  .get(function () {
    return this.fullName;
  })
  .set(function (val) {
    this.fullName = val;
  });

StudentPreDataSchema.virtual('enrollment_no')
  .get(function () {
    return this.enrollment;
  })
  .set(function (val) {
    this.enrollment = val;
  });

module.exports = mongoose.model('StudentPreData', StudentPreDataSchema);
