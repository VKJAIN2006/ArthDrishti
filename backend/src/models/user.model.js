const mongoose = require('mongoose');
const { hashPassword, verifyPassword } = require('../utils/auth.util');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['manager', 'admin'], default: 'manager' },
  },
  { timestamps: true }
);

userSchema.pre('save', function hashIfChanged() {
  if (!this.isModified('password')) return;
  if (!this.password.startsWith('scrypt$')) {
    this.password = hashPassword(this.password);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return verifyPassword(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
