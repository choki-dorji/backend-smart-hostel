// routes/maintenance.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import User from '../models/user-model.js';
import MaintenanceTicket from '../models/ticket.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/tickets'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only PNG/JPG/WebP images are allowed'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * POST /api/tickets
 * Accepts multipart/form-data with fields:
 * - title, category, description, priority, roomNumber
 * - attachment (optional file)
 */
router.post(
  '/',
  auth,
  requireRole('RESIDENT', 'ADMIN', 'WARDEN'),
  upload.single('attachment'), // IMPORTANT: parse multipart
  async (req, res) => {
    try {
      // For multipart, fields are strings on req.body, file on req.file
      const { title, category, description, priority, roomNumber } = req.body;

      if (!title || !category || !description) {
        return res.status(422).json({ error: 'title, category, and description are required' });
      }

      const imageUrl = req.file ? `/uploads/tickets/${req.file.filename}` : undefined;

      const doc = await MaintenanceTicket.create({
        title,
        category,
        description,
        priority: priority || 'medium',
        status: 'pending',
        submittedBy: req.user.id, // or req.user.name, depends on your schema
        roomNumber,
        imageUrl,
      });

      res.status(201).json({
        id: doc._id.toString(),
        title: doc.title,
        category: doc.category,
        description: doc.description,
        priority: doc.priority,
        status: doc.status,
        submittedBy: req.user.name || req.user.id,
        roomNumber: doc.roomNumber,
        submittedDate: doc.createdAt.toISOString().slice(0, 10),
        imageUrl: doc.imageUrl,
      });
    } catch (err) {
      console.error('Create ticket error:', err);
      res.status(400).json({ error: err.message || 'Failed to create ticket' });
    }
  }
);

// get by user - FIXED
router.get('/', auth, requireRole('RESIDENT', 'ADMIN', 'WARDEN'), async (req, res) => {
  try{
    const all = await MaintenanceTicket.find({
      "submittedBy": req.user.id
    })
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email') // ✅ Add this
    .populate('roomNumber', 'number block')
    .sort({ createdAt: -1 })
    .lean();
    return res.json(all);
  }catch(e){
    res.status(400).json({ error: e.message || 'Failed to fetch tickets' });
  }
});

// all tickets - admin/warden - FIXED
router.get('/all', auth, requireRole('ADMIN', 'WARDEN'), async (req, res) => {
  try{
    const all = await MaintenanceTicket.find()
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email') // ✅ Add this
    .populate('roomNumber', 'number block')
    .sort({ createdAt: -1 })
    .lean();
    return res.json(all);
  }catch(e){
    res.status(400).json({ error: e.message || 'Failed to fetch tickets' });
  }
});

// assigned to me - FIXED
router.get(
  '/assigned-to-me',
  auth,
  requireRole('MAINTENANCE'),
  async (req, res) => {
    try {
      const tickets = await MaintenanceTicket.find({ 
        assignedTo: req.user.id 
      })
      .populate('submittedBy', 'name email')
      .populate('assignedTo', 'name email') // ✅ Add this (though it will be current user)
      .populate('roomNumber', 'number block')
      .sort({ createdAt: -1 })
      .lean();

      res.json(tickets);
    } catch (error) {
      console.error('Fetch assigned tickets error:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch tickets' });
    }
  }
);

// Add these routes after your existing GET routes

/**
 * PATCH /api/tickets/:id/assign
 * Assign staff to a maintenance ticket
 */
/**
 * PATCH /api/tickets/:id/assign
 * Assign staff to a maintenance ticket
 */
router.patch(
  '/:id/assign',
  auth,
  requireRole('ADMIN', 'WARDEN', 'MAINTENANCE'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { staffId, notes } = req.body;
      const assignedBy = req.user.id;

      // Validate ticket exists
      const ticket = await MaintenanceTicket.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Validate staff exists and has MAINTENANCE role
      if (staffId) {
        const staff = await User.findOne({ 
          _id: staffId, 
          role: 'MAINTENANCE' 
        });
        
        if (!staff) {
          return res.status(400).json({ error: 'Invalid maintenance staff ID' });
        }
      }

      // Update assignment
      ticket.assignedTo = staffId || null;
      
      // Update status based on assignment
      if (staffId) {
        ticket.status = 'in-progress';
      } else {
        ticket.status = 'pending'; // Unassigning puts it back to pending
      }

      // Add to assignment history
      ticket.assignmentHistory.push({
        staff: staffId,
        assignedAt: new Date(),
        assignedBy: assignedBy,
        notes: notes || `Assigned to ${staffId ? 'staff member' : 'unassigned'}`
      });

      await ticket.save();

      // ✅ FIX: Properly populate all references including assignedTo
      const populatedTicket = await MaintenanceTicket.findById(id)
        .populate('submittedBy', 'name email')
        .populate('assignedTo', 'name email') // This was missing proper population
        .populate('roomNumber', 'number block')
        .lean();

      res.json({
        message: staffId ? 'Ticket assigned successfully' : 'Ticket unassigned',
        ticket: populatedTicket
      });
    } catch (error) {
      console.error('Assign ticket error:', error);
      res.status(400).json({ error: error.message || 'Failed to assign ticket' });
    }
  }
);
/**
 * PATCH /api/tickets/:id/status
 * Update ticket status
 */
router.patch(
  '/:id/status',
  auth,
  requireRole('ADMIN', 'WARDEN', 'MAINTENANCE'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const updatedBy = req.user.id;

      const validStatuses = ['pending', 'in-progress', 'resolved', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const ticket = await MaintenanceTicket.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Authorization: Only assigned staff or admins can update status
      if (req.user.role !== 'ADMIN' && req.user.role !== 'WARDEN') {
        if (ticket.assignedTo?.toString() !== req.user.id.toString()) {
          return res.status(403).json({ error: 'Not authorized to update this ticket' });
        }
      }

      const previousStatus = ticket.status;
      ticket.status = status;

      // Add status history
      ticket.statusHistory.push({
        status,
        changedAt: new Date(),
        changedBy: updatedBy,
        notes: notes || `Status changed from ${previousStatus} to ${status}`
      });

      await ticket.save();

      const populatedTicket = await MaintenanceTicket.findById(id)
        .populate('submittedBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('roomNumber', 'number block')
        .lean();

      res.json({
        message: 'Status updated successfully',
        ticket: populatedTicket
      });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(400).json({ error: error.message || 'Failed to update status' });
    }
  }
);

/**
 * GET /api/tickets/staff/available
 * Get available maintenance staff
 */
router.get(
  '/staff/available',
  auth,
  requireRole('ADMIN', 'WARDEN', 'MAINTENANCE'),
  async (req, res) => {
    try {
      const User = mongoose.model('User');
      
      const availableStaff = await User.aggregate([
        { $match: { role: 'MAINTENANCE' } },
        {
          $lookup: {
            from: 'maintenancetickets',
            let: { staffId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$assignedTo', '$$staffId'] },
                      { $in: ['$status', ['pending', 'in-progress']] }
                    ]
                  }
                }
              }
            ],
            as: 'activeTickets'
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            phone: 1,
            activeTicketCount: { $size: '$activeTickets' },
            isAvailable: { $lt: [{ $size: '$activeTickets' }, 5] } // Max 5 active tickets
          }
        },
        { $sort: { activeTicketCount: 1, name: 1 } }
      ]);

      res.json(availableStaff);
    } catch (error) {
      console.error('Fetch staff error:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch staff' });
    }
  }
);

/**
 * GET /api/tickets/assigned-to-me
 * Get tickets assigned to current maintenance staff
 */
router.get(
  '/assigned-to-me',
  auth,
  requireRole('MAINTENANCE'),
  async (req, res) => {
    try {
      const tickets = await MaintenanceTicket.find({ 
        assignedTo: req.user.id 
      })
      .populate('submittedBy', 'name email')
      .populate('roomNumber', 'number block')
      .sort({ createdAt: -1 })
      .lean();

      res.json(tickets);
    } catch (error) {
      console.error('Fetch assigned tickets error:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch tickets' });
    }
  }
);



export default router;
