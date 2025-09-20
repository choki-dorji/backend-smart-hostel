import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  body: String,
  read: { type: Boolean, default: false },
  meta: Object
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);
