const mongoose = require('mongoose');

const historyLogSchema = new mongoose.Schema({
  action: { type: String, required: true, enum: ['mở cửa', 'đóng cửa'] },
  method: { type: String, default: 'app' },  // 'app', 'thẻ từ', 'vân tay'
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: 'Unknown' },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['thành công', 'thất bại'], default: 'thành công' },
});

module.exports = mongoose.model('HistoryLog', historyLogSchema);