import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

export const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

export const objectIdParam = (name = 'id') =>
  param(name).custom((v) => isObjectId(v)).withMessage(`${name} must be a valid ObjectId`);

export const objectIdBody = (name) =>
  body(name).custom((v) => isObjectId(v)).withMessage(`${name} must be a valid ObjectId`);

export const optionalNonEmptyString = (field) =>
  body(field).optional().isString().trim().notEmpty().withMessage(`${field} cannot be empty when provided`);

export const optionalEnum = (field, values) =>
  body(field).optional().isIn(values).withMessage(`${field} must be one of: ${values.join(', ')}`);

// Common pagination (optional)
export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
