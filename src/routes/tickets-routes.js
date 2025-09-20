import express from 'express';
import Ticket from '../models/ticket.js';
import Notification from '../models/notification.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import { asyncHandler } from '../utils/async-handler.js';
import AppError from '../utils/app-error.js';

const router = express.Router();

// Resident creates ticket (FR6)
router.post('/', auth, requireRole('RESIDENT'), asyncHandler(async (req, res) => {
  const { title, description, imageUrl, roomId } = req.body;
  const t = await Ticket.create({
    resident: req.user.id,
    title, description, imageUrl, room: roomId
  });
  res.status(201).json(t);
}));

// Resident sees their tickets (FR8)
router.get('/me', auth, requireRole('RESIDENT'), asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ resident: req.user.id });
  res.json(tickets);
}));

// Warden views & assigns (FR7)
router.get('/', auth, requireRole('WARDEN','ADMIN','MAINTENANCE'), asyncHandler(async (req, res) => {
  const list = await Ticket.find().populate('resident','name').populate('assignedTo','name role');
  res.json(list);
}));

router.post('/:id/assign', auth, requireRole('WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const { userId } = req.body; // maintenance user
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new AppError('Ticket not found', 404);
  ticket.assignedTo = userId;
  ticket.status = 'IN_PROGRESS';
  await ticket.save();

  await Notification.create({
    user: ticket.resident,
    title: 'Ticket assigned',
    body: 'Your maintenance ticket is now in progress.',
    meta: { type: 'TICKET_ASSIGNED', ticketId: ticket._id }
  });

  res.json(ticket);
}));

// Maintenance updates status → RESOLVED
router.post('/:id/status', auth, requireRole('MAINTENANCE','WARDEN','ADMIN'), asyncHandler(async (req, res) => {
  const { status } = req.body; // IN_PROGRESS / RESOLVED
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new AppError('Ticket not found', 404);

  ticket.status = status;
  await ticket.save();

  if (status === 'RESOLVED') {
    await Notification.create({
      user: ticket.resident,
      title: 'Ticket resolved',
      body: 'Your issue has been resolved.',
      meta: { type: 'TICKET_RESOLVED', ticketId: ticket._id }
    });
  }

  res.json(ticket);
}));

export default router;
