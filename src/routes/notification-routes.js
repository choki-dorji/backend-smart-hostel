import express from 'express';
import Notification from '../models/notification.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = express.Router();

// Resident (or any user) sees their notifications (FR9)
router.get('/me', auth, asyncHandler(async (req, res) => {
  const list = await Notification.find({ user: req.user.id }).sort('-createdAt');
  res.json(list);
}));

router.post('/:id/read', auth, asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );
  res.json(n);
}));

export default router;
