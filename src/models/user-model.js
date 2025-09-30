import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ProfileSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, index: true, required: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['ADMIN', 'WARDEN', 'RESIDENT', 'MAINTENANCE'],
      required: true,
    },

    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
      lowercase: true,
    },

    // 👇 now an object with defaults
    profile: { type: ProfileSchema, default: {} },

    // phone numbers often have leading + / 0; store as string
    phone: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

export default mongoose.model('User', UserSchema);
