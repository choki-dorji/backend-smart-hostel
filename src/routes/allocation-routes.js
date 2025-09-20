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
router.post('/', auth, requireRole('RESIDENT'), asyncHandler(async (req, res) => {
  const { preferredType, reason } = req.body;
  const created = await AllocationRequest.create({ resident: req.user.id, preferredType, reason });
  res.status(201).json(created);
}));

// Warden/Admin list allocation requests
router.get('/', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const list = await AllocationRequest.find().populate('resident','name email').populate('assignedRoom','number');
  res.json(list);
}));

// Warden approves/denies allocation
router.post('/:id/decision', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const { status, roomId } = req.body; // status: APPROVED or DENIED
  const reqDoc = await AllocationRequest.findById(req.params.id);
  if (!reqDoc) throw new AppError('Request not found', 404);
  if (reqDoc.status !== 'PENDING') throw new AppError('Already decided', 409);

  if (status === 'APPROVED') {
    if (!roomId) throw new AppError('roomId required for approval', 422);
    const room = await Room.findById(roomId);
    if (!room) throw new AppError('Room not found', 404);
    if (room.occupants.length >= room.capacity) throw new AppError('Room is full', 409);

    // update room occupants
    room.occupants.push(reqDoc.resident);
    await room.save();

    // set request
    reqDoc.status = 'APPROVED';
    reqDoc.assignedRoom = room._id;
    reqDoc.decisionBy = req.user.id;
    reqDoc.decidedAt = new Date();
    await reqDoc.save();

    // notification
    await Notification.create({
      user: reqDoc.resident,
      title: 'Room allocation approved',
      body: `You have been allocated Room ${room.number}`,
      meta: { type: 'ALLOCATION_APPROVED', room: room.number }
    });
  } else if (status === 'DENIED') {
    reqDoc.status = 'DENIED';
    reqDoc.decisionBy = req.user.id;
    reqDoc.decidedAt = new Date();
    await reqDoc.save();

    await Notification.create({
      user: reqDoc.resident,
      title: 'Room allocation denied',
      body: 'Your allocation request was denied.',
      meta: { type: 'ALLOCATION_DENIED' }
    });
  } else {
    throw new AppError('Invalid status', 422);
  }

  // return resident snapshot (optional)
  const resident = await User.findById(reqDoc.resident).select('name email');
  res.json({ request: reqDoc, resident });
}));

export default router;
