// models/maintenance-ticket.js
import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
    status: { type: String, enum: ['pending','in-progress','resolved'], default: 'pending' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: String },
    roomNumber: { type: String },
    imageUrl: { type: String }, // <-- file URL/path (not binary)
  },
  { timestamps: true }
);

export default mongoose.model('MaintenanceTicket', schema);
