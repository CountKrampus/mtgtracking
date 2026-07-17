const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_]+$/, 'Role name can only contain lowercase letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  permissions: {
    type: [String],
    default: []
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

roleSchema.index({ isBuiltIn: 1 });

module.exports = mongoose.model('Role', roleSchema);
