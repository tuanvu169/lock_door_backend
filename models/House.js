const mongoose = require("mongoose");

const doorSchema = new mongoose.Schema({
  name: String,
  location: String,
  status: { type: String, enum: ["LOCKED", "UNLOCKED"], default: "LOCKED" },
});

const houseSchema = new mongoose.Schema({
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  name: { type: String, required: true },
  address: String,
  doors: [doorSchema],
}, {
  timestamps: true  // Tự động thêm createdAt, updatedAt
});

module.exports = mongoose.model("House", houseSchema);