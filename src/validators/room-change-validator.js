import { body } from 'express-validator';
import { objectIdParam } from './_helpers.js';

export const ROOM_CHANGE_STATUS = ['PENDING', 'APPROVED', 'DENIED'];

// Resident creates room change request
export const createRoomChangeValidator = [
  body('toRoomNumber').isString().trim().notEmpty().withMessage('toRoomNumber is required'),
  body('reason').optional().isString().trim().isLength({ max: 1000 })
];

// Warden/Admin decides on room change
// POST /api/room-changes/:id/decision  { status }
export const decideRoomChangeValidator = [
  objectIdParam('id'),
  body('status')
    .isIn(['APPROVED', 'DENIED'])
    .withMessage('status must be APPROVED or DENIED')
];
