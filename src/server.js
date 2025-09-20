import mongoose from 'mongoose';
import { env } from './config/env.js';
import app from './app.js';

mongoose.connect(env.mongoUri).then(() => {
  console.log('MongoDB connected');
  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});
