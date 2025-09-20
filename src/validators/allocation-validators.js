import { body } from 'express-validator';
import { objectIdParam, objectIdBody } from './_helpers.js';

export const ALLOCATION_STATUS = ['PENDING', 'APPROVED', 'DENIED'];
export const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE'];

// Resident creates allocation request
export const createAllocationValidator = [
  body('preferredType')
    .isIn(ROOM_TYPES)
    .withMessage(`preferredType must be one of: ${ROOM_TYPES.join(', ')}`),
  body('reason').optional().isString().trim().isLength({ max: 1000 })
];

// Warden/Admin decides on allocation
// POST /api/allocations/:id/decision  { status, roomId? }
export const decideAllocationValidator = [
  objectIdParam('id'),
  body('status')
    .isIn(['APPROVED', 'DENIED'])
    .withMessage('status must be APPROVED or DENIED'),
  // roomId only required when approving
  body('roomId')
    .if(body('status').equals('APPROVED'))
    .custom((v) => !!v)
    .withMessage('roomId is required when status is APPROVED'),
  body('roomId')
    .if(body('status').equals('APPROVED'))
    .custom((v) => v && v.length && v) // pass through value
    .bail()
    .custom((v) => /^[0-9a-fA-F]{24}$/.test(v))
    .withMessage('roomId must be a valid ObjectId'),
];
