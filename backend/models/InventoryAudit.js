const mongoose = require('mongoose');

const inventoryAuditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  locationName: { type: String, required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
  items: [{
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    name: { type: String, required: true },
    set: { type: String, default: '' },
    condition: { type: String, default: '' },
    isFoil: { type: Boolean, default: false },
    expectedQuantity: { type: Number, required: true, min: 0 },
    countedQuantity: { type: Number, default: null, min: 0 }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

inventoryAuditSchema.index({ userId: 1, locationId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryAudit', inventoryAuditSchema);
