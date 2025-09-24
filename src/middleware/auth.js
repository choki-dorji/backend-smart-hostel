import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import AppError from "../utils/app-error.js";

export const auth = (req, res, next) => {
  let token;

  // 1. Try from Authorization header
  const hdr = req.headers.authorization || "";
  if (hdr.startsWith("Bearer ")) {
    token = hdr.slice(7);
  }

  console.log("Token:", token);

  // 2. If not found, try from cookies
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError("Unauthorized", 401));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload; // { id, role }
    return next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
};
