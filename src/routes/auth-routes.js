import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/user-model.js'
import { validationResult } from 'express-validator';
import { loginValidator } from '../validators/auth-validators.js';
import { asyncHandler } from '../utils/async-handler.js';
import AppError from '../utils/app-error.js';
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Seed/admin creation (optional) – comment out in prod
router.post('/seed-admin', asyncHandler(async (req, res) => {
  const exists = await User.findOne({ role: 'ADMIN' });
  if (exists) return res.json({ message: 'Admin already exists' });
  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@hostelhub.local',
    password: 'Admin@12345',
    role: 'ADMIN',
    gender:'male'
  });
  res.json({ message: 'Admin created', id: admin._id });
}));

router.post('/login', loginValidator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Invalid credentials', 422);

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);

  const ok = await user.comparePassword(password);
  if (!ok) throw new AppError('Invalid email or password', 401);


  const token = jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

 
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role }});
}));

router.post('/register', loginValidator,
  asyncHandler(async (req, res) => {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) throw new AppError('Invalid input data', 422);

    const { name, email, password, role, gender } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) throw new AppError('Email already registered', 409);

    // Create new user
    const user = await User.create({ name, email, password, role, gender });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  })
);

router.get("/me", auth, async (req, res) => {
  try {
    // look up the user in DB if you want fullx  info
    const user = await User.findById(req.user.id).select("_id name email role gender");
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    console.log(user);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
