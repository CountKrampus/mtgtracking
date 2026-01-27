# Security, Settings & Configuration Ideas

## High Priority

### User Settings
- **Settings Page**: Dedicated settings page (not just locations/tags in a modal) with sections:
  - Display preferences (theme, density, default view)
  - Pricing preferences (source, currency, condition multipliers)
  - Notification preferences
  - Data management (backup, restore, clear)
  - About / version info
- **Default Values**: Set default condition (NM), default location, default tags for new cards
- **Items Per Page Setting**: Choose 10, 20, 50, or 100 cards per page
- **Default Sort Setting**: Choose default sort order that persists across sessions
- **Auto-Update Prices**: Toggle to automatically update prices daily/weekly in the background
- **Display Currency**: Choose display currency (USD, CAD, EUR) with conversion

### Data Management
- **Clear Collection**: Button to wipe entire collection with confirmation (for fresh start)
- **Clear Cache**: Button to clear cached images and Scryfall data
- **Storage Usage Display**: Show how much disk space is used by images, database, etc.
- **Database Statistics**: Show total cards, unique cards, images cached, database size
- **Import/Export Settings**: Export and import app settings (not just cards)

### Security
- **Password Protection**: Optional PIN or password to access the app (local only)
- **Encrypted Backups**: Encrypt exported backup files with a password
- **Secure Environment Variables**: Validate that .env files aren't accidentally committed to git
- **HTTPS Enforcement**: Enforce HTTPS in production for secure API communication
- **Content Security Policy**: Add CSP headers to prevent XSS attacks
- **Input Sanitization Audit**: Review all user inputs for injection vulnerabilities
- **Rate Limiting on All Endpoints**: Prevent abuse of API endpoints

## Medium Priority

### Configuration Panel 1
- **Pricing Configuration Panel**: Configure pricing sources, currency, condition multipliers in UI
- **API Key Management**: UI for managing API keys if integrating with paid services
- **Notification Settings**: Granular control over which notifications to receive
- **Privacy Settings**: Control what's shared publicly vs privately
- **Data Retention Settings**: Auto-delete price history older than X months to save space
- **Feature Toggles**: Enable/disable features you don't use to simplify the UI

### Configuration Panel 1.1
- **Automatic Scheduled Backups**: Daily/weekly auto-backup to local folder or cloud storage
- **Backup Rotation**: Keep last N backups and auto-delete older ones
- **Point-in-Time Recovery**: Restore collection to any backup point
- **Differential Backups**: Only back up changes since last full backup for faster/smaller backups
- **Backup Verification**: Verify backup integrity before restoring
- **Cloud Backup Destinations**: Backup to Google Drive, Dropbox, OneDrive, or custom S3 bucket

### Configuration Panel 1.2/Multi-User
- **User Accounts**: Optional user account system for multi-user installations
- **Family/Household Mode**: Multiple collections under one installation (one per family member)
- **Guest Access**: Read-only guest view for showing collection to friends
- **Permission Levels**: Admin (full access), Editor (add/edit cards), Viewer (read-only)
- **Activity Log / Audit Trail**: Track who changed what and when (useful for shared collections)

## Configuration Panel 1.3/Lower Priority

- **Two-Factor Authentication**: 2FA for account security (if multi-user)
- **OAuth Login**: Login with Google, Discord, or GitHub accounts
- **Session Management**: View and revoke active sessions
- **Data Export for GDPR**: Export all personal data on request
- **Account Deletion**: Full account and data deletion option
- **Terms of Service**: If hosting publicly, proper ToS and privacy policy
- **Cookie Consent**: GDPR-compliant cookie consent banner if using analytics
- **API Rate Limit Dashboard**: View your current API usage and limits
- **Maintenance Mode**: Admin toggle to put the app in maintenance mode
- **System Health Dashboard**: Admin view showing server stats, DB health, cache status
