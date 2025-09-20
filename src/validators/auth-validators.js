import { body } from 'express-validator';

export const loginValidator = [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 })
];

export const createUserValidator = [
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('role').isIn(['ADMIN','WARDEN','RESIDENT','MAINTENANCE'])
];
