import express from 'express';
import RoomChangeRequest from '../models/room-change-request.js';
import Room from '../models/room-model.js';
import Notification from '../models/notification.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';
import AppError from '../utils/app-error.js';

const router = express.Router();

router.post('/', auth, requireRole('RESIDENT'), asyncHandler(async (req, res) => {
  const { toRoomNumber, reason } = req.body;

  // Optional: auto-detect current room for resident
  const currentRoom = await Room.findOne({ occupants: req.user.id });
  const created = await RoomChangeRequest.create({
    resident: req.user.id,
    fromRoom: currentRoom?._id,
    toRoomNumber,
    reason
  });
  res.status(201).json(created);
}));

router.get('/', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const list = await RoomChangeRequest.find().populate('resident','name').populate('fromRoom','number');
  res.json(list);
}));

router.post('/:id/decision', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const { status } = req.body; // APPROVED / DENIED
  const doc = await RoomChangeRequest.findById(req.params.id);
  if (!doc) throw new AppError('Request not found', 404);
  if (doc.status !== 'PENDING') throw new AppError('Already decided', 409);

  if (status === 'APPROVED') {
    const targetRoom = await Room.findOne({ number: doc.toRoomNumber });
    if (!targetRoom) throw new AppError('Target room not found', 404);
    if (targetRoom.occupants.length >= targetRoom.capacity) throw new AppError('Target room full', 409);

    // Remove from old room (if any)
    if (doc.fromRoom) {
      await Room.updateOne({ _id: doc.fromRoom }, { $pull: { occupants: doc.resident } });
    }
    // Add to new room
    targetRoom.occupants.push(doc.resident);
    await targetRoom.save();

    doc.status = 'APPROVED';
    doc.decisionBy = req.user.id;
    doc.decidedAt = new Date();
    await doc.save();

    await Notification.create({
      user: doc.resident,
      title: 'Room change approved',
      body: `You have been moved to Room ${targetRoom.number}`,
      meta: { type: 'ROOM_CHANGE_APPROVED', room: targetRoom.number }
    });
  } else if (status === 'DENIED') {
    doc.status = 'DENIED';
    doc.decisionBy = req.user.id;
    doc.decidedAt = new Date();
    await doc.save();

    await Notification.create({
      user: doc.resident,
      title: 'Room change denied',
      body: 'Your room change request was denied.',
      meta: { type: 'ROOM_CHANGE_DENIED' }
    });
  } else {
    throw new AppError('Invalid status', 422);
  }

  res.json(doc);
}));

export default router;
