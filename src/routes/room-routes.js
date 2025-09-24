import express from 'express';
import Room from '../models/room-model.js';
import Block from '../models/block-model.js';
import User from '../models/user-model.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// FR4 – Admin/Warden manage rooms

// Create a new room
router.post('/', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  // Validate that the block exists
  const block = await Block.findById(req.body.block);
  if (!block) {
    return res.status(400).json({ error: 'Invalid block ID' });
  }

  // Validate floor doesn't exceed block's total_floors
  if (req.body.floor > block.total_floors) {
    return res.status(400).json({
      error: `Floor cannot exceed block's total floors (${block.total_floors})`
    });
  }

  // Check if room with same number already exists in the same block
  const existingRoom = await Room.findOne({
    block: req.body.block,
    number: req.body.number
  });

  if (existingRoom) {
    return res.status(400).json({
      error: 'Room with this number already exists in the specified block'
    });
  }

  // Create the room
  const room = await Room.create(req.body);

  // Populate block information in response (include type)
  const populatedRoom = await Room.findById(room._id)
    .populate('block', 'name description total_floors type');

  res.status(201).json(populatedRoom);
}));

// Get all rooms with filtering and pagination
router.get('/', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};

  if (req.query.block) filter.block = req.query.block;
  if (req.query.floor) filter.floor = req.query.floor;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  // Search by room number
  if (req.query.search) {
    filter.number = { $regex: req.query.search, $options: 'i' };
  }

  const rooms = await Room.find(filter)
    .populate('block', 'name description type')
    .populate('occupants', 'name email studentId')
    .sort({ 'block.name': 1, floor: 1, number: 1 })
    .skip(skip)
    .limit(limit);

  const total = await Room.countDocuments(filter);

  res.json({
    rooms,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get a specific room by ID (include block.type for gender filtering on FE)
router.get('/:id', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate('block', 'name description total_floors type')
    .populate('occupants', 'name email studentId phone');

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json(room);
}));

// Assign a RESIDENT to a room (enforce capacity & gender)
router.post('/:id/assign', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const roomId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const room = await Room.findById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const user = await User.findById(userId).select('role name email gender');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role !== 'RESIDENT') {
    return res.status(400).json({ error: 'Only RESIDENT users can be assigned to rooms' });
  }

  // Gender enforcement based on hostel type
  const block = await Block.findById(room.block).select('type total_floors');
  if (!block) return res.status(400).json({ error: 'Invalid block for room' });

  const g = (user.gender || '').toLowerCase();
  if (block.type === 'boys' && g !== 'male') {
    return res.status(400).json({ error: 'Only male residents can be assigned to boys hostel' });
  }
  if (block.type === 'girls' && g !== 'female') {
    return res.status(400).json({ error: 'Only female residents can be assigned to girls hostel' });
  }

  // Capacity check
  const capMap = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3 };
  const capacity = room.capacity ?? capMap[room.type] ?? 1;
  const occ = (room.occupants || []).length;
  if (occ >= capacity) {
    return res.status(400).json({ error: 'Room is already at full capacity' });
  }

  // Check if resident already has a room
  const alreadyIn = await Room.findOne({ occupants: userId }).select('_id');
  if (alreadyIn) {
    return res.status(400).json({ error: 'Resident is already assigned to a room' });
  }

  // Assign
  room.occupants = room.occupants || [];
  if (room.occupants.some(id => id.toString() === userId)) {
    return res.status(400).json({ error: 'Resident already in this room' });
  }
  room.occupants.push(userId);
  room.current_occupancy = room.occupants.length;

  // Optional: auto-flip status when first occupant added
  if (room.current_occupancy > 0 && room.status === 'AVAILABLE') {
    room.status = 'OCCUPIED';
  }

  const saved = await room.save();
  await saved.populate([
    { path: 'block', select: 'name description total_floors type' },
    { path: 'occupants', select: 'name email studentId phone' },
  ]);

  res.json(saved);
}));

// Unassign a RESIDENT from a room
router.post('/:id/unassign', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const roomId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const room = await Room.findById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const beforeLen = (room.occupants || []).length;
  room.occupants = (room.occupants || []).filter(id => id.toString() !== userId);
  if (room.occupants.length === beforeLen) {
    return res.status(400).json({ error: 'Resident is not in this room' });
  }

  room.current_occupancy = room.occupants.length;

  // Optional: auto-flip status back to AVAILABLE if empty (don’t override MAINTENANCE/UNAVAILABLE)
  if (room.current_occupancy === 0 && room.status === 'OCCUPIED') {
    room.status = 'AVAILABLE';
  }

  const saved = await room.save();
  await saved.populate([
    { path: 'block', select: 'name description total_floors type' },
    { path: 'occupants', select: 'name email studentId phone' },
  ]);

  res.json(saved);
}));

// Update a room (safe: triggers pre('save'))
router.patch('/:id', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // If block is changing, validate
  if (req.body.block && req.body.block !== room.block.toString()) {
    const newBlock = await Block.findById(req.body.block);
    if (!newBlock) return res.status(400).json({ error: 'Invalid block ID' });

    // unique (block, number)
    const numberToUse = req.body.number ?? room.number;
    const exists = await Room.findOne({ block: req.body.block, number: numberToUse, _id: { $ne: room._id } });
    if (exists) return res.status(400).json({ error: 'Room with this number already exists in the specified block' });
  }

  // If floor provided, validate against target block
  if (req.body.floor != null) {
    const blockId = req.body.block ?? room.block;
    const block = await Block.findById(blockId);
    if (!block) return res.status(400).json({ error: 'Invalid block ID' });
    if (req.body.floor > block.total_floors) {
      return res.status(400).json({ error: `Floor cannot exceed block's total floors (${block.total_floors})` });
    }
  }

  // Apply incoming fields
  room.set(req.body);

  // Ensure capacity matches type if type changed
  const capMap = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3 };
  if (req.body.type) {
    room.capacity = capMap[room.type];
  }

  // Keep occupancy count sane if occupants changed
  if (req.body.occupants) {
    room.current_occupancy = room.occupants.length;
  }

  const updated = await room.save();
  await updated.populate([
    { path: 'block', select: 'name description type' },
  ]);
  res.json(updated);
}));

// Delete a room (only ADMIN)
router.delete('/:id', auth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Check if room has occupants
  if (room.occupants.length > 0) {
    return res.status(400).json({
      error: 'Cannot delete room with occupants. Please vacate the room first.'
    });
  }

  await Room.findByIdAndDelete(req.params.id);
  res.status(204).send();
}));

// Get available rooms by type
router.get(
  '/availability/:type',
  auth,
  requireRole('ADMIN','WARDEN','RESIDENT'),
  asyncHandler(async (req, res) => {
    const typeRaw = (req.params.type || '').toString();
    const type = typeRaw.toUpperCase();

    if (!['SINGLE', 'DOUBLE', 'TRIPLE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid room type' });
    }

    const blockId = req.query.block;
    const capMap = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3 };

    // be tolerant to how "type" was saved in DB (SINGLE, Single, single)
    const typeMatch = [type, type.toLowerCase(), type[0] + type.slice(1).toLowerCase()];

    const query = { type: { $in: typeMatch } };
    if (blockId) query.block = blockId;

    // pull basic fields; populate block for FE
    const rooms = await Room.find(query)
      .select('number type floor capacity current_occupancy occupants status block')
      .populate('block', 'name description type');

    // keep only rooms with free slots; ignore maintenance/unavailable if you use those
    const available = rooms.filter((r) => {
      const capFromType = capMap[(r.type || '').toString().toUpperCase()] ?? 1;
      const cap = typeof r.capacity === 'number' ? r.capacity : capFromType;

      const occ =
        typeof r.current_occupancy === 'number'
          ? r.current_occupancy
          : Array.isArray(r.occupants)
          ? r.occupants.length
          : 0;

      const badStatus = r.status && ['MAINTENANCE', 'UNAVAILABLE'].includes(String(r.status).toUpperCase());
      return !badStatus && occ < cap;
    });

    // optional: sort for stable UX
    available.sort((a, b) => {
      const an = a.block?.name?.toString() || '';
      const bn = b.block?.name?.toString() || '';
      if (an !== bn) return an.localeCompare(bn);
      const af = a.floor ?? 0;
      const bf = b.floor ?? 0;
      if (af !== bf) return af - bf;
      // if room numbers are strings like 'A-101', fallback to lexicographic
      return (a.number || '').toString().localeCompare((b.number || '').toString());
    });

    res.json(available);
  })
);


// Get room occupancy statistics
router.get('/stats/occupancy', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const stats = await Room.getOccupancyStats();
  res.json(stats);
}));

// Get rooms by block
router.get('/block/:blockId', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const { blockId } = req.params;
  const { floor, status } = req.query;

  const filter = { block: blockId };
  if (floor) filter.floor = floor;
  if (status) filter.status = status;

  const rooms = await Room.find(filter)
    .populate('block', 'name')
    .populate('occupants', 'name')
    .sort({ floor: 1, number: 1 });

  res.json(rooms);
}));

export default router;
