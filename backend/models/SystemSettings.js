const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'maintenanceMode',
      'registrationEnabled',
      'defaultUserRole',
      'sessionTimeout',
      'maxSessionsPerUser',
      'referralsEnabled',
      'referralSignupRep',
      'referralQualificationRep',
      'referralReferredRep',
      'referralQualificationThreshold'
    ]
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// key is already indexed via unique: true

// Static method to get a setting value
systemSettingsSchema.statics.getValue = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set a setting value
systemSettingsSchema.statics.setValue = async function(key, value, userId = null) {
  return this.findOneAndUpdate(
    { key },
    {
      key,
      value,
      updatedBy: userId,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
};

// Static method to get all settings
systemSettingsSchema.statics.getAll = async function() {
  const settings = await this.find().populate('updatedBy', 'username');
  return settings.reduce((acc, setting) => {
    acc[setting.key] = {
      value: setting.value,
      description: setting.description,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt
    };
    return acc;
  }, {});
};

// Static method to initialize default settings
systemSettingsSchema.statics.initializeDefaults = async function() {
  const defaults = [
    {
      key: 'maintenanceMode',
      value: false,
      description: 'When enabled, only admins can access the system'
    },
    {
      key: 'registrationEnabled',
      value: true,
      description: 'When disabled, new user registration is blocked'
    },
    {
      key: 'defaultUserRole',
      value: 'editor',
      description: 'Default role for newly registered users'
    },
    {
      key: 'sessionTimeout',
      value: 7, // days
      description: 'Number of days before refresh tokens expire'
    },
    {
      key: 'maxSessionsPerUser',
      value: 10,
      description: 'Maximum number of active sessions per user'
    },
    {
      key: 'referralsEnabled',
      value: true,
      description: 'When disabled, the referral program is turned off end-to-end'
    },
    {
      key: 'referralSignupRep',
      value: 10,
      description: 'Reputation awarded to the referrer when a referred user signs up'
    },
    {
      key: 'referralQualificationRep',
      value: 50,
      description: 'Reputation awarded to the referrer when a referred user activates'
    },
    {
      key: 'referralReferredRep',
      value: 10,
      description: 'Reputation awarded to the referred user when they activate'
    },
    {
      key: 'referralQualificationThreshold',
      value: 20,
      description: 'Number of cards a referred user must own to count as activated'
    }
  ];

  for (const setting of defaults) {
    await this.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    );
  }
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
