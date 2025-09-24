import mongoose from 'mongoose';

const BlockSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  description: { 
    type: String, 
    default: ''
  },
  total_floors: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  type: {
    type: String,
    enum: ['boys', 'girls'], // ✅ Only boys or girls allowed
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  }
}, { timestamps: true });

// Virtual for getting all rooms in this block
BlockSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'block'
});

export default mongoose.model('Block', BlockSchema);
