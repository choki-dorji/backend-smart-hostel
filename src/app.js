import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth-routes.js';
import blockRoutes from './routes/block-routes.js';
import usersRoutes from './routes/user-routes.js';
import roomsRoutes from './routes/room-routes.js';
import allocationsRoutes from './routes/allocation-routes.js';
import roomChangesRoutes from './routes/roomchange-routes.js';
import ticketsRoutes from './routes/tickets-routes.js';
import notificationsRoutes from './routes/notification-routes.js';
import adminAllocationRouter from './routes/admin-allocate.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

fs.mkdirSync('uploads/tickets', { recursive: true });

// Parse JSON/urlencoded for non-multipart routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*", // allow all origins
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.resolve('uploads')));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/allocation', adminAllocationRouter);
app.use("/api/block", blockRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/allocations', allocationsRoutes);
app.use('/api/room-changes', roomChangesRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/notifications', notificationsRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  console.log("error :", err)
  const msg = err.isOperational ? err.message : 'Internal Server Error';
  res.status(status).json({ message: msg });
});

export default app;
