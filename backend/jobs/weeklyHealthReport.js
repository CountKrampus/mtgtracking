const cron = require('node-cron');
const User = require('../models/User');
const ValueSnapshot = require('../models/ValueSnapshot');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { generateHealthReportForUser } = require('../utils/healthReport');
const { createHealthReportNotification } = require('../utils/notifications');

async function runWeeklyHealthReport() {
  const mongoose = require('mongoose');
  // Card model is registered by server.js before this job runs
  const Card = mongoose.model('Card');

  const started = Date.now();
  let usersProcessed = 0;
  let reportsCreated = 0;
  let errors = 0;

  console.log('[weeklyHealthReport] Starting weekly collection health report generation...');

  let users;
  try {
    users = await User.find({ 'notificationPreferences.healthReportEnabled': true }).select('_id').lean();
  } catch (err) {
    console.error('[weeklyHealthReport] Failed to load opted-in users:', err.message);
    return { usersProcessed: 0, reportsCreated: 0, errors: 1 };
  }

  for (const user of users) {
    usersProcessed++;
    try {
      const report = await generateHealthReportForUser(user._id, {
        Card, ValueSnapshot, CardPriceSnapshot, CollectionHealthReport
      });
      await createHealthReportNotification(user._id, report._id, report.valueChange);
      reportsCreated++;
    } catch (err) {
      console.error(`[weeklyHealthReport] Error for user ${user._id}:`, err.message);
      errors++;
    }
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[weeklyHealthReport] Done. Users processed: ${usersProcessed} | Reports created: ${reportsCreated} | Errors: ${errors} | Duration: ${duration}s`
  );

  return { usersProcessed, reportsCreated, errors };
}

function registerWeeklyHealthReportJob() {
  // Run at 00:10 every Sunday — offset from the existing daily price snapshot job's
  // 00:05 slot (backend/jobs/dailyPriceSnapshot.js) to avoid contention.
  cron.schedule('10 0 * * 0', () => {
    runWeeklyHealthReport().catch(err =>
      console.error('[weeklyHealthReport] Unhandled error:', err.message)
    );
  });
  console.log('[weeklyHealthReport] Weekly collection health report job registered (00:10 Sundays)');
}

module.exports = { registerWeeklyHealthReportJob, runWeeklyHealthReport };
