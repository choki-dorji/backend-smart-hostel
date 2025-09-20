import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import AppError from '../utils/app-error.js';

export const auth = (req, res, next) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return next(new AppError('Unauthorized', 401));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload; // { id, role }
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};
