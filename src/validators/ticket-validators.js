import { body } from 'express-validator';
import { objectIdParam, objectIdBody, optionalNonEmptyString } from './_helpers.js';

export const TICKET_STATUS = ['PENDING', 'IN_PROGRESS', 'RESOLVED'];

// Resident creates ticket
export const createTicketValidator = [
  body('title').isString().trim().notEmpty().withMessage('title is required'),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('imageUrl').optional().isString().trim().isURL().withMessage('imageUrl must be a valid URL'),
  objectIdBody('roomId').optional()
];

// Resident reads own tickets — no validator needed for GET /me

// Warden/Admin assigns ticket to maintenance user
// POST /api/tickets/:id/assign  { userId }
export const assignTicketValidator = [
  objectIdParam('id'),
  objectIdBody('userId')
];

// Maintenance/Warden/Admin updates ticket status
// POST /api/tickets/:id/status  { status }
export const updateTicketStatusValidator = [
  objectIdParam('id'),
  body('status')
    .isIn(['PENDING', 'IN_PROGRESS', 'RESOLVED'])
    .withMessage(`status must be one of: ${TICKET_STATUS.join(', ')}`)
];

// Optional: filter/pagination for GET /api/tickets
export const listTicketsQueryValidator = [
  // e.g. ?status=IN_PROGRESS
  // You can apply these on the route as query validators if you add them
];
