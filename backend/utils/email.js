const nodemailer = require('nodemailer');

// Email configuration
const getEmailConfig = () => {
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: (process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    }
  };

  // If no email config is provided, return null to indicate email is disabled
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return config;
};

// Create transporter
const createTransporter = () => {
  const config = getEmailConfig();
  
  if (!config) {
    console.warn('Email configuration not found. Password reset emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport(config);
};

// Send password reset email with temporary password
const sendPasswordResetEmail = async (user, tempPassword) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.error('Cannot send password reset email: email not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset - Temporary Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.displayName || user.username},</p>
        <p>You have requested to reset your password. Your account has been updated with a temporary password:</p>
        <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        <p>Please log in with this temporary password and change it immediately in your account settings.</p>
        <p>For security reasons, this temporary password should be changed as soon as possible.</p>
        <p>If you didn't request this, please contact an administrator immediately.</p>
        <br>
        <p>Best regards,<br>The MTG Tracker Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Send password changed notification
const sendPasswordChangedEmail = async (user) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.warn('Cannot send password changed notification: email not configured');
    return false;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Changed Successfully',
      html: `
        <h2>Password Changed Successfully</h2>
        <p>Hello ${user.displayName || user.username},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact support immediately.</p>
        <br>
        <p>Best regards,<br>The MTG Tracker Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password changed email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  createTransporter,
  getEmailConfig
};