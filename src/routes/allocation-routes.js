import express from 'express';
import AllocationRequest from '../models/allocation-request.js';
import Room from '../models/room-model.js';
import Notification from '../models/notification.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';
import AppError from '../utils/app-error.js';
import User from '../models/user-model.js';

const router = express.Router();

// Resident submits allocation request (FR1/FR5 flow entry)
// POST /api/allocation
router.post(
  '/',
  auth,
  requireRole('RESIDENT'),
  asyncHandler(async (req, res) => {
    const { reason, currentRoom, preferredRooms, preferredType } = req.body;
    if (!reason || reason.trim().length < 10) {
      throw new AppError('Reason is required (min 10 chars)', 422);
    }

    // Create allocation request
    const allocationRequest = await AllocationRequest.create({
      resident: req.user.id,
      reason,
      currentRoom,
      preferredRooms,
      preferredType,
      status: 'PENDING'
    });

    // Optionally, notify warden/admin here

    res.status(201).json(allocationRequest);
  })
);

// get all 
router.get(
  '/',
  auth,
  requireRole('ADMIN','WARDEN'),
  asyncHandler(async (req, res) => {
    const items = await AllocationRequest.find({})
      .sort({ createdAt: -1 })
      .populate('resident', 'name email')
      // ✅ use camelCase schema fields
      .populate('currentRoom', 'number')
      .populate('preferredRooms', 'number');

    res.json(items);
  })
);

// for user
router.get(
  '/mine',
  auth,
  requireRole('RESIDENT', 'ADMIN', 'WARDEN', 'MAINTENANCE'),
  asyncHandler(async (req, res) => {
    const docs = await AllocationRequest.find({ resident: req.user.id })
      .sort({ createdAt: -1 })
      .populate('currentRoom', 'number')
      .populate('preferredRooms', 'number');

    res.json(docs);
  })
);





// Warden/Admin list allocation requests
router.get('/', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const list = await AllocationRequest.find().populate('resident','name email').populate('assignedRoom','number');
  res.json(list);
}));



export default router;
