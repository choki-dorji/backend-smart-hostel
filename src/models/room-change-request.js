import mongoose from 'mongoose';

const RoomChangeRequestSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  toRoomNumber: String,
  reason: String,
  status: { type: String, enum: ['PENDING','APPROVED','DENIED'], default: 'PENDING' },
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date
}, { timestamps: true });

export default mongoose.model('RoomChangeRequest', RoomChangeRequestSchema);
