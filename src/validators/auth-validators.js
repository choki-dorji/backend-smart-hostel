import { body } from 'express-validator';

export const loginValidator = [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 })
];

export const createUserValidator = [
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('role').isIn(['ADMIN','WARDEN','RESIDENT','MAINTENANCE']),
  body('gender').isIn(['male', 'female'])
];


export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
  body('role')
    .customSanitizer(v => String(v || '').toUpperCase())
    .isIn(['ADMIN','WARDEN','RESIDENT','MAINTENANCE'])
    .withMessage('Role must be ADMIN|WARDEN|RESIDENT|MAINTENANCE'),
  body('gender')
    .customSanitizer(v => String(v || '').toLowerCase())
    .isIn(['male','female'])
    .withMessage("Gender must be 'male' or 'female'"),
];
