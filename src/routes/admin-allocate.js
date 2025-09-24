// src/routes/admin-alocation.js
import express from 'express';
import Room from '../models/room-model.js';
import Block from '../models/block-model.js';
import User from '../models/user-model.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

/**
 * Utilities
 */
const capMap = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3 };

async function getAssignedRoomId(userId) {
  const found = await Room.findOne({ occupants: userId }).select('_id');
  return found?._id?.toString() || null;
}

function roomHasSpace(roomDoc) {
  const cap = roomDoc.capacity ?? capMap[roomDoc.type] ?? 1;
  const occ = roomDoc.occupants?.length ?? 0;
  return occ < cap;
}

/**
 * GET /unassigned-residents
 * Returns residents not currently assigned to ANY room.
 * Supports ?q= to search name/email and ?limit=
 */
router.get(
  '/unassigned-residents',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    // all currently assigned user ids
    const assignedIds = await Room.distinct('occupants');

    const filter = {
      role: 'RESIDENT',
      _id: { $nin: assignedIds },
    };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email studentId')
      .sort({ name: 1 })
      .limit(limit);

    res.json(users);
  })
);

/**
 * GET /room/:roomId/occupants
 * Returns occupants of a room (populated)
 */
router.get(
  '/room/:roomId/occupants',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const room = await Room.findById(req.params.roomId)
      .populate('occupants', 'name email studentId phone');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room.occupants || []);
  })
);

/**
 * POST /assign
 * Body: { roomId, userId }
 * Assign a RESIDENT to a room (no implicit moving; use /move for that).
 * Returns the updated room (populated).
 */
router.post(
  '/assign',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const { roomId, userId } = req.body || {};
    if (!roomId || !userId) {
      return res.status(400).json({ error: 'roomId and userId are required' });
    }

    const user = await User.findById(userId).select('role name email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'RESIDENT') {
      return res.status(400).json({ error: 'Only RESIDENT users can be assigned to rooms' });
    }

    const alreadyIn = await getAssignedRoomId(userId);
    if (alreadyIn) {
      return res.status(400).json({ error: 'Resident is already assigned to a room. Use /move instead.' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // validate floor vs block total_floors (defensive)
    const block = await Block.findById(room.block);
    if (!block) return res.status(400).json({ error: 'Invalid block for room' });
    if (room.floor > block.total_floors) {
      return res.status(400).json({ error: `Room floor exceeds block total floors (${block.total_floors})` });
    }

    if (!roomHasSpace(room)) {
      return res.status(400).json({ error: 'Room is already at full capacity' });
    }

    // push & save
    if (!room.occupants) room.occupants = [];
    if (room.occupants.some(id => id.toString() === userId)) {
      return res.status(400).json({ error: 'Resident already in this room' });
    }
    room.occupants.push(userId);
    room.current_occupancy = room.occupants.length;

    const updated = await room.save();
    await updated
      .populate('block', 'name description')
      .populate('occupants', 'name email studentId phone');

    res.status(200).json(updated);
  })
);

/**
 * POST /unassign
 * Body: { userId, roomId? }
 * Unassign a RESIDENT from a room. If roomId omitted, it finds current room.
 * Returns the updated room (populated).
 */
router.post(
  '/unassign',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const { userId, roomId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const fromRoomId = roomId || (await getAssignedRoomId(userId));
    if (!fromRoomId) return res.status(400).json({ error: 'Resident is not assigned to any room' });

    const room = await Room.findById(fromRoomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    room.occupants = (room.occupants || []).filter(id => id.toString() !== userId);
    room.current_occupancy = room.occupants.length;

    const updated = await room.save();
    await updated
      .populate('block', 'name description')
      .populate('occupants', 'name email studentId phone');

    res.json(updated);
  })
);

/**
 * POST /move
 * Body: { userId, toRoomId }
 * Move a resident from their current room to a target room atomically (best-effort).
 * Returns { from: <room>, to: <room> } both populated.
 */
router.post(
  '/move',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const { userId, toRoomId } = req.body || {};
    if (!userId || !toRoomId) {
      return res.status(400).json({ error: 'userId and toRoomId are required' });
    }

    const user = await User.findById(userId).select('role');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'RESIDENT') {
      return res.status(400).json({ error: 'Only RESIDENT users can be moved' });
    }

    const fromRoom = await Room.findOne({ occupants: userId });
    if (!fromRoom) {
      return res.status(400).json({ error: 'Resident is not assigned to any room' });
    }

    if (fromRoom._id.toString() === toRoomId) {
      return res.status(400).json({ error: 'Resident is already in the target room' });
    }

    const toRoom = await Room.findById(toRoomId);
    if (!toRoom) return res.status(404).json({ error: 'Target room not found' });
    if (!roomHasSpace(toRoom)) {
      return res.status(400).json({ error: 'Target room is at full capacity' });
    }

    // Remove from old
    fromRoom.occupants = (fromRoom.occupants || []).filter(id => id.toString() !== userId);
    fromRoom.current_occupancy = fromRoom.occupants.length;
    await fromRoom.save();

    // Add to new
    if (!toRoom.occupants) toRoom.occupants = [];
    toRoom.occupants.push(userId);
    toRoom.current_occupancy = toRoom.occupants.length;
    await toRoom.save();

    const [fromPop, toPop] = await Promise.all([
      Room.findById(fromRoom._id)
        .populate('block', 'name description')
        .populate('occupants', 'name email studentId phone'),
      Room.findById(toRoom._id)
        .populate('block', 'name description')
        .populate('occupants', 'name email studentId phone'),
    ]);

    res.json({ from: fromPop, to: toPop });
  })
);

/**
 * GET /available
 * Optional query: type=SINGLE|DOUBLE|TRIPLE, block=<blockId>
 * Mirrors convenience lookup for admins when allocating.
 */
router.get(
  '/available',
  auth,
  requireRole('ADMIN', 'WARDEN'),
  asyncHandler(async (req, res) => {
    const { type, block } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (block) filter.block = block;

    const rooms = await Room.find(filter)
      .populate('block', 'name description')
      .sort({ 'block.name': 1, floor: 1, number: 1 });

    const withSpace = rooms.filter(r => roomHasSpace(r));
    res.json(withSpace);
  })
);

// GET /admin-allocation/my-room
// Returns the room the logged-in RESIDENT currently belongs to (or null if none)
router.get(
  '/my-room',
  auth,
  requireRole('RESIDENT'),
  asyncHandler(async (req, res) => {
    const room = await Room.findOne({ occupants: req.user.id })
      .populate('block', 'name description type total_floors')
      .populate('occupants', 'name email studentId phone');

    // return null instead of 404 so UI can easily handle "Not Assigned"
    res.json(room || null);
  })
);


export default router;
