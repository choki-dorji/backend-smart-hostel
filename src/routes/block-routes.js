import express from 'express';
import Block from '../models/block-model.js';
import Room from '../models/room-model.js'; // ✅ you use it below
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();
const VALID_TYPES = ['boys', 'girls'];
const VALID_STATUSES = ['active', 'inactive', 'maintenance'];

// FR - Admin/Warden manage blocks

// Create a new block
router.post('/', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  const { description = '', total_floors, status = 'active', type } = req.body;

  // Validate required
  if (!name || total_floors == null || type == null) {
    return res.status(400).json({ error: 'Block name, total floors, and type are required' });
  }

  // Validate business rules
  if (total_floors <= 0) {
    return res.status(400).json({ error: 'Total floors must be a positive number' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be one of: 'boys', 'girls'" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: active, inactive, maintenance' });
  }

  // Uniqueness by name
  const existingBlock = await Block.findOne({ name });
  if (existingBlock) {
    return res.status(400).json({ error: 'Block with this name already exists' });
  }

  const block = await Block.create({ name, description, total_floors, status, type });
  res.status(201).json(block);
}));

// Get all blocks (optional filter by ?type=boys|girls)
router.get('/', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.type) {
    if (!VALID_TYPES.includes(req.query.type)) {
      return res.status(400).json({ error: "Invalid type filter. Use 'boys' or 'girls'." });
    }
    query.type = req.query.type;
  }
  const blocks = await Block.find(query).sort({ name: 1 });
  res.json(blocks);
}));

// Get a specific block by ID
router.get('/:id', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const block = await Block.findById(req.params.id);
  if (!block) return res.status(404).json({ error: 'Block not found' });
  res.json(block);
}));

// Update a block
router.patch('/:id', auth, requireRole('ADMIN','WARDEN'), asyncHandler(async (req, res) => {
  const existingBlock = await Block.findById(req.params.id);
  if (!existingBlock) return res.status(404).json({ error: 'Block not found' });

  // If name is being updated, check duplicates
  if (req.body.name && req.body.name.trim() !== existingBlock.name) {
    const duplicateBlock = await Block.findOne({ 
      name: req.body.name.trim(), 
      _id: { $ne: req.params.id } 
    });
    if (duplicateBlock) return res.status(400).json({ error: 'Another block with this name already exists' });
  }

  // Validate fields if present
  if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: active, inactive, maintenance' });
  }
  if (req.body.total_floors != null && req.body.total_floors <= 0) {
    return res.status(400).json({ error: 'Total floors must be a positive number' });
  }
  if (req.body.type && !VALID_TYPES.includes(req.body.type)) {
    return res.status(400).json({ error: "Invalid type. Must be one of: 'boys', 'girls'" });
  }

  // (Optional) Prevent switching type if rooms already exist
  // if (req.body.type && req.body.type !== existingBlock.type) {
  //   const roomCount = await Room.countDocuments({ block: existingBlock._id });
  //   if (roomCount > 0) {
  //     return res.status(400).json({ error: 'Cannot change block type while rooms exist in this block' });
  //   }
  // }

  const updatedBlock = await Block.findByIdAndUpdate(
    req.params.id,
    { 
      ...req.body,
      ...(req.body.name && { name: req.body.name.trim() })
    },
    { new: true, runValidators: true }
  );

  res.json(updatedBlock);
}));

// Delete a block (only ADMIN)
router.delete('/:id', auth, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const block = await Block.findById(req.params.id);
  if (!block) return res.status(404).json({ error: 'Block not found' });

  // Prevent deletion if the block still has rooms
  const roomCount = await Room.countDocuments({ block: block._id });
  if (roomCount > 0) {
    return res.status(400).json({ error: 'Cannot delete block that still has rooms. Delete/move rooms first.' });
  }

  await Block.findByIdAndDelete(req.params.id);
  res.status(204).send();
}));

// Get rooms in a specific block
router.get('/:id/rooms', auth, requireRole('ADMIN','WARDEN','RESIDENT','MAINTENANCE'), asyncHandler(async (req, res) => {
  const block = await Block.findById(req.params.id);
  if (!block) return res.status(404).json({ error: 'Block not found' });

  const rooms = await Room.find({ block: req.params.id })
    .populate('occupants', 'name email')
    .sort({ floor: 1, number: 1 });

  res.json({
    block: {
      _id: block._id,
      name: block.name,
      description: block.description,
      total_floors: block.total_floors,
      status: block.status,
      type: block.type, // ✅ include hostel type
    },
    rooms
  });
}));

export default router;
