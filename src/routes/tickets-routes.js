// routes/maintenance.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import MaintenanceTicket from '../models/ticket.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

// storage config (save to disk under /uploads/tickets)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/tickets'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);             // keep extension
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
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

// POST /api/maintenance
router.post(
  '/',
  auth,
  requireRole('RESIDENT', 'ADMIN', 'WARDEN'),
  upload.single('attachment'), // field name must match FormData key
  async (req, res) => {
    console.log('Received ticket submission:', req.body, req.file);
    try {
      const { title, category, description, priority, roomNumber } = req.body;

      const imageUrl = req.file ? `/uploads/tickets/${req.file.filename}` : undefined;

      const doc = await MaintenanceTicket.create({
        title,
        category,
        description,
        priority,
        status: 'pending',
        submittedBy: req.user.id,
        roomNumber,
        imageUrl,
      });

      console.log('Created ticket:', doc);

      res.status(201).json({
        id: doc._id,
        title: doc.title,
        category: doc.category,
        description: doc.description,
        priority: doc.priority,
        status: doc.status,
        submittedBy: req.user.name || req.user.id, // adjust as needed
        roomNumber: doc.roomNumber,
        submittedDate: doc.createdAt.toISOString().slice(0,10),
        imageUrl: doc.imageUrl,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to create ticket' });
    }
  }
);

export default router;
