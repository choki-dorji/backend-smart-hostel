import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  imageUrl: String,
  status: { type: String, enum: ['PENDING','IN_PROGRESS','RESOLVED'], default: 'PENDING' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // MAINTENANCE
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
}, { timestamps: true });

export default mongoose.model('Ticket', TicketSchema);
