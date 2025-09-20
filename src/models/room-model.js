import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['SINGLE','DOUBLE','TRIPLE'], required: true },
  capacity: { type: Number, required: true, min: 1 },
  occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

export default mongoose.model('Room', RoomSchema);
