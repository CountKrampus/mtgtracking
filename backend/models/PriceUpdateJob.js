const mongoose = require('mongoose');

// Durable record of a background price-update job.
//
// The old admin force-price-update kept jobs only in an in-memory map, so the
// "Recent Price Jobs" panel had nothing to show (and a server restart erased
// every running job from existence). This model persists each job's counters
// as it runs, so the admin panel can list history and re-attach to a job by ID
// even after a restart.
const priceUpdateJobSchema = new mongoose.Schema({
  // NOTE: this schema has an `errors` path — a reserved-ish Mongoose document
  // name (validation errors live on doc.errors), hence the suppress flag. This
  // model is only ever read via .lean() and written via updateOne/$set, never
  // through a document's validation-error property.
  jobId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['running', 'complete', 'failed'],
    default: 'running'
  },
  // 'admin-panel' = started from the admin Pricing tab
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  scope: {
    type: String,
    enum: ['all', 'user'],
    default: 'all'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  options: {
    force: { type: Boolean, default: false },
    fullData: { type: Boolean, default: false }
  },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  // Cap stored errors so a pathological run (every card failing) doesn't
  // bloat the document past MongoDB's 16MB limit.
  errors: {
    type: [{ card: String, error: String }],
    default: []
  },
  error: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { suppressReservedKeysWarning: true });

// Recent-first list for the admin panel
priceUpdateJobSchema.index({ startedAt: -1 });
priceUpdateJobSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model('PriceUpdateJob', priceUpdateJobSchema);
