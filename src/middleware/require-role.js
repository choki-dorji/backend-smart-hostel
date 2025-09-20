import AppError from '../utils/app-error.js';

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Unauthorized', 401));
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden: insufficient permissions', 403));
  }
  next();
};
