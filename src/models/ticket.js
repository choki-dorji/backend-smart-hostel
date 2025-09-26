// models/ticket.js
import mongoose from 'mongoose';

const maintenanceTicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'resolved', 'cancelled'], 
    default: 'pending' 
  },
  roomNumber: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Room',
    required: true 
  },
  submittedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  imageUrl: String,
  
  // Track assignment history
  assignmentHistory: [{
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }],
  
  // Status history
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }]
}, {
  timestamps: true
});

export default mongoose.model('MaintenanceTicket', maintenanceTicketSchema);