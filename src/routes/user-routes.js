import express from 'express';
import User from '../models/user-model.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { createUserValidator } from '../validators/auth-validators.js';
import { validationResult } from 'express-validator';
import { asyncHandler } from '../utils/async-handler.js';
import AppError from '../utils/app-error.js';

const router = express.Router();

// Admin creates users (residents, wardens, maintenance, admins)
router.post('/', auth, requireRole('ADMIN'), createUserValidator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Validation failed', 422);
  const exists = await User.findOne({ email: req.body.email });
  if (exists) throw new AppError('Email already in use', 409);
  const user = await User.create(req.body);
  res.status(201).json({ id: user._id });
}));

// Admin/Warden list users
router.get('/', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
}));

// Resident updates own profile
router.patch('/me', auth, requireRole('RESIDENT','WARDEN','MAINTENANCE','ADMIN'), asyncHandler(async (req, res) => {
  const updates = { name: req.body.name, profile: req.body.profile };
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
  res.json(user);
}));

export default router;
