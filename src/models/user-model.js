import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, index: true, required: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['ADMIN','WARDEN','RESIDENT','MAINTENANCE'], required: true },

  // ✅ Gender added
  gender: { type: String, enum: ['male', 'female'], required: true,     lowercase: true,           // 👈 ensure stored lowercase
 },

  profile: {
    phone: String,
    studentId: String,
    avatarUrl: String
  }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function(pw) {
  return bcrypt.compare(pw, this.password);
};

export default mongoose.model('User', UserSchema);
