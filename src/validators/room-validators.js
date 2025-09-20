import { body } from 'express-validator';
import { optionalNonEmptyString } from './_helpers.js';

export const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE'];

export const createRoomValidator = [
  body('number').isString().trim().notEmpty().withMessage('number is required'),
  body('type').isIn(ROOM_TYPES).withMessage(`type must be one of: ${ROOM_TYPES.join(', ')}`),
  body('capacity').isInt({ min: 1 }).withMessage('capacity must be an integer >= 1'),
];

export const updateRoomValidator = [
  optionalNonEmptyString('number'),
  body('type').optional().isIn(ROOM_TYPES).withMessage(`type must be one of: ${ROOM_TYPES.join(', ')}`),
  body('capacity').optional().isInt({ min: 1 }).withMessage('capacity must be an integer >= 1'),
];
