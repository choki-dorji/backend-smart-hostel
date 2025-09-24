import mongoose from 'mongoose';

const AllocationRequestSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  preferredType: { type: String, enum: ['SINGLE','DOUBLE','TRIPLE'], required: true },
  reason: String,
  status: { type: String, enum: ['PENDING','APPROVED','DENIED'], default: 'PENDING' },
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  currentRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  preferredRooms: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },

}, { timestamps: true });

export default mongoose.model('AllocationRequest', AllocationRequestSchema);
