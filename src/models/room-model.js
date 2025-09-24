// import mongoose from 'mongoose';

// const RoomSchema = new mongoose.Schema({
//   number: { type: String, required: true, unique: true },
//   type: { type: String, enum: ['SINGLE','DOUBLE','TRIPLE'], required: true },
//   capacity: { type: Number, required: true, min: 1 },
//   occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
// }, { timestamps: true });

// export default mongoose.model('Room', RoomSchema);

import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  block: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Block', 
    required: true 
  },
  number: { 
    type: String, 
    required: true,
    trim: true
  },
  floor: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: async function(floor) {
        const block = await mongoose.model('Block').findById(this.block);
        return block && floor <= block.total_floors;
      },
      message: 'Floor cannot exceed block\'s total floors'
    }
  },
  type: { 
    type: String, 
    enum: ['SINGLE', 'DOUBLE', 'TRIPLE'], 
    required: true 
  },
  capacity: { 
    type: Number, 
    required: true, 
    min: 1,
    validate: {
      validator: function(capacity) {
        const capacityMap = {
          'SINGLE': 1,
          'DOUBLE': 2,
          'TRIPLE': 3
        };
        return capacity === capacityMap[this.type];
      },
      message: 'Capacity must match room type (SINGLE=1, DOUBLE=2, TRIPLE=3)'
    }
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE'],
    default: 'AVAILABLE'
  },
  amenities: {
    attached_bathroom: { type: Boolean, default: false },
    air_conditioned: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false }
  },
  current_occupancy: {
    type: Number,
    default: 0,
    validate: {
      validator: function(occupancy) {
        return occupancy <= this.capacity;
      },
      message: 'Current occupancy cannot exceed room capacity'
    }
  },
  occupants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if room is full
RoomSchema.virtual('isFull').get(function() {
  return this.current_occupancy >= this.capacity;
});

// Virtual for available beds
RoomSchema.virtual('availableBeds').get(function() {
  return this.capacity - this.current_occupancy;
});

// Compound index to ensure room numbers are unique within a block
RoomSchema.index({ block: 1, number: 1 }, { unique: true });

// Index for efficient querying
RoomSchema.index({ block: 1, floor: 1 });
RoomSchema.index({ status: 1 });
RoomSchema.index({ type: 1 });

// Pre-save middleware to update current_occupancy based on occupants array
RoomSchema.pre('save', function(next) {
  this.current_occupancy = this.occupants.length;
  next();
});

// Static method to get available rooms by type
RoomSchema.statics.findAvailableByType = function(roomType, blockId = null) {
  const query = { 
    type: roomType, 
    status: 'AVAILABLE',
    current_occupancy: { $lt: this.schema.path('capacity').options.default }
  };
  
  if (blockId) {
    query.block = blockId;
  }
  
  return this.find(query).populate('block', 'name');
};

// Static method to get room occupancy statistics
RoomSchema.statics.getOccupancyStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$type',
        totalRooms: { $sum: 1 },
        occupiedRooms: {
          $sum: {
            $cond: [{ $eq: ['$status', 'OCCUPIED'] }, 1, 0]
          }
        },
        totalCapacity: { $sum: '$capacity' },
        totalOccupancy: { $sum: '$current_occupancy' }
      }
    }
  ]);
  
  return stats;
};

export default mongoose.model('Room', RoomSchema);
