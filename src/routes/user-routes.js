import express from 'express';
import User from '../models/user-model.js';
import Room from '../models/room-model.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

/**
 * GET /api/users
 * Query:
 *  - role=RESIDENT|WARDEN|ADMIN|MAINTENANCE
 *  - unassigned=true (RESIDENTs not assigned to any room)
 *  - gender=male|female
 *  - q=search (name/email/studentId)
 *  - limit=50 (default 50, max 200)
 */
router.get(
  '/',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const { role, unassigned, q, gender, limit } = req.query;
    const max = Math.min(parseInt(limit, 10) || 50, 200);

    const filter = {};
    if (role) filter.role = String(role).toUpperCase();

    if (unassigned === 'true') {
      // users not present in any room's occupants
      const assignedIds = await Room.distinct('occupants');
      filter._id = { $nin: assignedIds.filter(Boolean) };
    }

    if (gender) {
      // schema stores lowercase; accept case-insensitive
      filter.gender = new RegExp(`^${String(gender)}$`, 'i');
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { 'profile.studentId': { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email role gender createdAt profile.studentId')
      .sort({ name: 1 })
      .limit(max)
      .lean();

    // Optional: flatten studentId for convenience
    const shaped = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      gender: u.gender,
      createdAt: u.createdAt,
      studentId: u?.profile?.studentId,
    }));

    res.json(shaped);
  })
);

router.get(
  '/maintenance',    
  auth,
  requireRole('ADMIN', 'WARDEN', 'MAINTENANCE'),
  asyncHandler(async (req, res) => {
    const staff = await User.find({ role: 'MAINTENANCE' }) // Fixed: added filter
      .select('name email role') // Select relevant fields
      .sort({ name: 1 })
      .lean();
    
    res.json(staff);
  })
);

/**
 * GET /api/users/:id
 */
router.get(
  '/:id',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select('name email role gender createdAt profile')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  })
);

/**
 * POST /api/users
 * Body: { name, email, password?, role, gender, profile? }
 * - If password not provided, defaults to name (weak—use only if you intend to force reset).
 * - ADMIN only by default.
 */
router.post(
  '/',
  auth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, gender, profile } = req.body || {};

    if (!name || !email || !role || !gender) {
      return res.status(400).json({ error: 'name, email, role, and gender are required' });
    }

    const normalized = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: (password ? String(password) : String(name)).trim(), // default password = name
      role: String(role).toUpperCase(),
      gender: String(gender).toLowerCase(),
      profile: profile || {},
    };

    const existing = await User.findOne({ email: normalized.email }).select('_id');
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const created = await User.create(normalized);
    const safe = await User.findById(created._id)
      .select('name email role gender createdAt profile')
      .lean();

    res.status(201).json(safe);
  })
);

/**
 * PATCH /api/users/:id
 * Body: { name?, email?, role?, gender?, profile? }
 * - ADMIN only by default.
 */
router.patch(
  '/:id',
  auth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name, email, role, gender, profile, password } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await User.findOne({
        email: String(email).toLowerCase(),
        _id: { $ne: user._id },
      }).select('_id');
      if (existing) return res.status(409).json({ error: 'Email already in use' });
      user.email = String(email).toLowerCase();
    }

    if (name != null) user.name = String(name).trim();
    if (role != null) user.role = String(role).toUpperCase();
    if (gender != null) user.gender = String(gender).toLowerCase();
    if (profile != null) user.profile = { ...(user.profile || {}), ...profile };

    // Optional: allow password change
    if (password) {
      user.password = String(password); // pre('save') will hash
    }

    const saved = await user.save();
    const safe = await User.findById(saved._id)
      .select('name email role gender createdAt profile')
      .lean();

    res.json(safe);
  })
);

/**
 * DELETE /api/users/:id
 * - ADMIN only by default.
 * - Auto-unassign from any rooms, fix occupancy/status.
 */
router.delete(
  '/:id',
  auth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await User.findById(userId).select('_id role');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Clean up room occupants (if any)
    const rooms = await Room.find({ occupants: userId });
    for (const room of rooms) {
      room.occupants = (room.occupants || []).filter((id) => id.toString() !== userId);
      room.current_occupancy = room.occupants.length;
      // If it was occupied and is now empty, flip to AVAILABLE (don’t override maintenance/unavailable)
      if (room.current_occupancy === 0 && room.status === 'OCCUPIED') {
        room.status = 'AVAILABLE';
      }
      await room.save();
    }

    await User.findByIdAndDelete(userId);
    // 204 No Content is fine; your frontend doesn’t need a body
    res.status(204).send();
  })
);

export default router;
