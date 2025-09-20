import express from 'express';
import Room from '../models/room-model.js';
import { auth } from '../middleware/auth.js';
import { createRoomChangeValidator } from '../validators/room-change-validator.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// FR4 – Admin/Warden manage rooms
router.post('/', auth, requireRole('ADMIN','WARDEN'), createRoomChangeValidator, asyncHandler(async (req, res) => {
  const room = await Room.create(req.body);
  res.status(201).json(room);
}));

router.get('/', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const rooms = await Room.find().populate('occupants','name role');
  res.json(rooms);
}));

router.patch('/:id', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(room);
}));

export default router;
