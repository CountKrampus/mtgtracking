# Google Sheets Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** This feature is **deferred** — do not start this plan until it is explicitly requested. It is written to be immediately actionable whenever that happens.

**Goal:** Let a signed-in user connect their own Google account (OAuth, not a service account) and push a one-way snapshot of their card collection into a Google Sheet they own, reusing the exact 21-column field mapping the existing CSV export already produces.

**Architecture:** Extract the CSV export's per-card field mapping out of `backend/server.js` into a shared `backend/utils/collectionExport.js` module used by both `GET /api/export/csv` and the new `POST /api/integrations/google-sheets/export`. Add a new `backend/routes/googleSheets.js` router (mounted at `/api/integrations/google-sheets`, following the existing `injectDependencies(Card)` pattern used by `backend/routes/decks.js`) backed by a new `GoogleIntegration` model that stores an AES-256-GCM-encrypted refresh token per user. A thin `backend/utils/googleSheetsClient.js` wrapper isolates all `googleapis` calls so route tests can mock the `googleapis` package directly. Because Google's OAuth redirect lands on the backend with no `Authorization` header, the `connect` step encodes the user's id in a short-lived signed JWT `state` parameter that the `callback` step verifies — this bridging mechanism is not mentioned in the design spec and had to be designed from scratch (see "Spec gaps filled in" below).

**Tech Stack:** Node.js + Express + Mongoose (backend), `googleapis` npm package (new dependency), Node's built-in `crypto` (AES-256-GCM) for encryption at rest, React + axios + `ToastContext` (frontend), Jest + Supertest + `mongodb-memory-server` for tests (existing conventions).

---

## Spec accuracy notes (verified against the real codebase before writing this plan)

The design spec (`docs/superpowers/specs/2026-07-09-google-sheets-export-design.md`) is directionally correct but has three gaps that would have caused a stalled implementation if followed literally:

1. **No encryption helper exists.** The spec says "reuse whatever encryption helper the codebase already has for sensitive stored values — check `utils/` at implementation time." I checked: `backend/utils/` has no encrypt/decrypt helper anywhere (only `crypto.randomBytes` used for opaque random IDs in `utils/jwt.js` and `models/PasswordResetToken.js`, never for encrypting-then-decrypting a stored secret). The spec's own fallback ("Node's built-in `crypto` ... is sufficient") is correct and is what this plan builds (Task 3).
2. **The OAuth callback can't identify the user by session/JWT.** The spec says the callback route "stores the refresh token on a new `GoogleIntegration` model" but never explains how the callback — which is a plain browser redirect from Google carrying no `Authorization` header — knows which app user is completing the flow. This plan closes that gap with a signed `state` JWT (`{ userId, purpose: 'google-sheets-connect' }`, 10-minute expiry) generated in `/connect` and verified in `/callback` (Task 8–9).
3. **No status endpoint.** The spec's frontend section says "once connected, shows an Export to Google Sheets button" but never says how the frontend knows whether it's connected. This plan adds `GET /api/integrations/google-sheets/status` (Task 8) for that purpose.

Everything else in the spec — the 21-column field list, the create-then-reuse spreadsheet-id flow, overwrite-on-every-export, the `GoogleIntegration` shape, and the testing requirements — was verified against `backend/server.js:1312-1357` (the real CSV export handler) and matches exactly.

---

## File structure

- Create: `backend/utils/collectionExport.js` — shared 21-column field mapping (`EXPORT_HEADERS`, `EXPORT_QUOTED_COLUMNS`, `cardToExportRow`)
- Modify: `backend/server.js:1311-1357` — CSV export route now calls the shared helper instead of duplicating the mapping
- Create: `backend/utils/googleTokenCrypto.js` — AES-256-GCM encrypt/decrypt for the stored refresh token
- Create: `backend/models/GoogleIntegration.js` — `{ userId, refreshTokenEncrypted, spreadsheetId, connectedAt }`
- Modify: `backend/models/ActivityLog.js` — add 3 new `action` enum values + an `integration` category
- Modify: `backend/middleware/activityLogger.js` — add `googleSheetsConnect`, `googleSheetsExport`, `googleSheetsDisconnect` loggers
- Modify: `backend/package.json` — add `googleapis` dependency
- Create: `backend/utils/googleSheetsClient.js` — thin wrapper around `googleapis` (OAuth URL, code exchange, spreadsheet create/write, revoke)
- Create: `backend/routes/googleSheets.js` — `GET /connect`, `GET /callback`, `GET /status`, `POST /export`, `DELETE /`
- Modify: `backend/server.js` (near line 594, after the deck-folder routes mount) — require + mount the new router
- Modify: `backend/.env.local`, `backend/.env.cloud` — new env var templates
- Modify: `INSTALL.md` — new "Google Sheets Export Setup (Optional)" section
- Create: `backend/__tests__/collection-export-helper.test.js`
- Create: `backend/__tests__/google-sheets-crypto.test.js`
- Create: `backend/__tests__/google-sheets-integration.test.js` (route tests, built incrementally across Tasks 8–11)
- Modify: `frontend/src/App.js` — Google Sheets connection state + handlers, passed to `Sidebar` and `SettingsView`
- Modify: `frontend/src/components/SettingsView.js` (Data tab, ~line 253-308) — Connect/Disconnect UI
- Modify: `frontend/src/components/Sidebar.js` (actionItems, ~line 144-178) — "Export to Google Sheets" button, shown only when connected

---

## Task 1: Extract the shared collection-export helper

**Files:**
- Create: `backend/utils/collectionExport.js`
- Test: `backend/__tests__/collection-export-helper.test.js`

- [ ] **Step 1: Write the failing test**

```js
const { EXPORT_HEADERS, EXPORT_QUOTED_COLUMNS, cardToExportRow } = require('../utils/collectionExport');

describe('collectionExport helper', () => {
  test('EXPORT_HEADERS has the 21 documented columns in order', () => {
    expect(EXPORT_HEADERS).toEqual([
      'Name', 'Set', 'Set Code', 'Collector Number', 'Rarity',
      'Quantity', 'Condition', 'Price', 'Total Value',
      'Colors', 'Types', 'Mana Cost', 'Tags', 'Location',
      'Is Token', 'Is Foil', 'Scryfall ID', 'Image URL', 'Oracle Text',
      'Created At', 'Updated At'
    ]);
  });

  test('EXPORT_QUOTED_COLUMNS has one boolean per header', () => {
    expect(EXPORT_QUOTED_COLUMNS).toHaveLength(EXPORT_HEADERS.length);
    expect(EXPORT_QUOTED_COLUMNS.every(v => typeof v === 'boolean')).toBe(true);
  });

  test('cardToExportRow maps every field in the documented order', () => {
    const card = {
      name: 'Sol Ring',
      set: 'Commander 2021',
      setCode: 'C21',
      collectorNumber: '263',
      rarity: 'uncommon',
      quantity: 2,
      condition: 'NM',
      price: 1.5,
      colors: [],
      types: ['Artifact'],
      manaCost: '{1}',
      tags: ['staple', 'ramp'],
      location: 'Binder A',
      isToken: false,
      isFoil: true,
      scryfallId: 'abc-123',
      imageUrl: 'https://img.example/sol-ring.jpg',
      oracleText: '{T}: Add {C}{C}.',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(cardToExportRow(card)).toEqual([
      'Sol Ring', 'Commander 2021', 'C21', '263', 'uncommon',
      2, 'NM', 1.5, 3,
      '', 'Artifact', '{1}', 'staple;ramp', 'Binder A',
      'No', 'Yes', 'abc-123', 'https://img.example/sol-ring.jpg', '{T}: Add {C}{C}.',
      '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'
    ]);
  });

  test('cardToExportRow handles missing optional fields without throwing', () => {
    const card = { name: 'Forest', quantity: 1, price: 0, condition: 'NM' };
    const row = cardToExportRow(card);
    expect(row[0]).toBe('Forest');
    expect(row[5]).toBe(1); // Quantity
    expect(row[8]).toBe(0); // Total Value (price * quantity)
    expect(row[19]).toBe(''); // Created At, missing
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest collection-export-helper -v`
Expected: FAIL with "Cannot find module '../utils/collectionExport'"

- [ ] **Step 3: Write the implementation**

```js
// backend/utils/collectionExport.js
//
// Shared field-mapping for collection export. Both `GET /api/export/csv` and
// `POST /api/integrations/google-sheets/export` need the exact same 21 columns —
// this is the single source of truth so they can never drift apart.
//
// cardToExportRow() returns RAW values (numbers as numbers, strings unescaped).
// - The CSV route wraps values with its own escapeCSV(), using EXPORT_QUOTED_COLUMNS
//   to decide which columns need quoting (numeric/boolean-ish columns are left bare,
//   matching the CSV route's pre-existing output byte-for-byte).
// - The Google Sheets route sends the raw row straight to the Sheets API, which
//   handles its own value typing/escaping.

const EXPORT_HEADERS = [
  'Name', 'Set', 'Set Code', 'Collector Number', 'Rarity',
  'Quantity', 'Condition', 'Price', 'Total Value',
  'Colors', 'Types', 'Mana Cost', 'Tags', 'Location',
  'Is Token', 'Is Foil', 'Scryfall ID', 'Image URL', 'Oracle Text',
  'Created At', 'Updated At'
];

// true = CSV route wraps this column in double quotes (text-ish fields);
// false = left bare (numbers, Yes/No flags, ISO timestamps) — matches the
// original inline CSV export logic exactly.
const EXPORT_QUOTED_COLUMNS = [
  true, true, true, true, true,       // Name, Set, Set Code, Collector Number, Rarity
  false, true, false, false,          // Quantity, Condition, Price, Total Value
  true, true, true, true, true,       // Colors, Types, Mana Cost, Tags, Location
  false, false,                       // Is Token, Is Foil
  true, true, true,                   // Scryfall ID, Image URL, Oracle Text
  false, false                        // Created At, Updated At
];

/**
 * Convert a Card document (or a plain object with the same fields) into a
 * flat array of raw values matching EXPORT_HEADERS, in the same order.
 * @param {Object} card
 * @returns {Array<string|number>}
 */
function cardToExportRow(card) {
  const colors = card.colors ? card.colors.join(';') : '';
  const types = card.types ? card.types.join(';') : '';
  const tags = card.tags ? card.tags.join(';') : '';
  const totalValue = (card.price || 0) * (card.quantity || 0);

  return [
    card.name || '',
    card.set || '',
    card.setCode || '',
    card.collectorNumber || '',
    card.rarity || '',
    card.quantity,
    card.condition || '',
    card.price,
    totalValue,
    colors,
    types,
    card.manaCost || '',
    tags,
    card.location || '',
    card.isToken ? 'Yes' : 'No',
    card.isFoil ? 'Yes' : 'No',
    card.scryfallId || '',
    card.imageUrl || '',
    card.oracleText || '',
    card.createdAt ? card.createdAt.toISOString() : '',
    card.updatedAt ? card.updatedAt.toISOString() : ''
  ];
}

module.exports = { EXPORT_HEADERS, EXPORT_QUOTED_COLUMNS, cardToExportRow };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest collection-export-helper -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/collectionExport.js backend/__tests__/collection-export-helper.test.js
git commit -m "feat: extract shared collection export field mapping"
```

---

## Task 2: Refactor the CSV export route to use the shared helper

**Files:**
- Modify: `backend/server.js:1311-1357`

- [ ] **Step 1: Replace the inline mapping with the shared helper**

Current code at `backend/server.js:1311-1357`:

```js
// Export collection as CSV
app.get('/api/export/csv', requireAuth, activityLoggers.exportCsv, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);

    // Helper to escape CSV fields
    const escapeCSV = (str) => str ? `"${String(str).replace(/"/g, '""')}"` : '""';

    const csvHeader = 'Name,Set,Set Code,Collector Number,Rarity,Quantity,Condition,Price,Total Value,Colors,Types,Mana Cost,Tags,Location,Is Token,Is Foil,Scryfall ID,Image URL,Oracle Text,Created At,Updated At\n';
    const csvRows = cards.map(card => {
      const colors = card.colors ? card.colors.join(';') : '';
      const types = card.types ? card.types.join(';') : '';
      const tags = card.tags ? card.tags.join(';') : '';
      const totalValue = card.price * card.quantity;
      return [
        escapeCSV(card.name),
        escapeCSV(card.set),
        escapeCSV(card.setCode),
        escapeCSV(card.collectorNumber),
        escapeCSV(card.rarity),
        card.quantity,
        escapeCSV(card.condition),
        card.price,
        totalValue,
        escapeCSV(colors),
        escapeCSV(types),
        escapeCSV(card.manaCost),
        escapeCSV(tags),
        escapeCSV(card.location),
        card.isToken ? 'Yes' : 'No',
        card.isFoil ? 'Yes' : 'No',
        escapeCSV(card.scryfallId),
        escapeCSV(card.imageUrl),
        escapeCSV(card.oracleText),
        card.createdAt ? card.createdAt.toISOString() : '',
        card.updatedAt ? card.updatedAt.toISOString() : ''
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mtg-collection.csv');
    res.send(csvHeader + csvRows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

Replace with:

```js
// Export collection as CSV
app.get('/api/export/csv', requireAuth, activityLoggers.exportCsv, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);

    // Helper to escape CSV fields
    const escapeCSV = (value) => (value === '' || value === null || value === undefined)
      ? '""'
      : `"${String(value).replace(/"/g, '""')}"`;

    const csvHeader = EXPORT_HEADERS.join(',') + '\n';
    const csvRows = cards.map(card => {
      const row = cardToExportRow(card);
      return row.map((value, i) => (EXPORT_QUOTED_COLUMNS[i] ? escapeCSV(value) : value)).join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mtg-collection.csv');
    res.send(csvHeader + csvRows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 2: Add the import at the top of `backend/server.js`**

Find the existing import block that includes `const { activityLoggers } = require('./middleware/activityLogger');` (line 18) and add directly below it:

```js
const { EXPORT_HEADERS, EXPORT_QUOTED_COLUMNS, cardToExportRow } = require('./utils/collectionExport');
```

- [ ] **Step 3: Verify no behavior change by hand**

Run: `cd backend && node -e "
const { EXPORT_HEADERS, EXPORT_QUOTED_COLUMNS, cardToExportRow } = require('./utils/collectionExport');
const escapeCSV = (v) => (v === '' || v == null) ? '\"\"' : '\"' + String(v).replace(/\"/g,'\"\"') + '\"';
const card = { name: 'Sol Ring', set: 'C21', quantity: 2, price: 1.5, condition: 'NM', isFoil: true, isToken: false, createdAt: new Date(), updatedAt: new Date() };
const row = cardToExportRow(card).map((v,i)=> EXPORT_QUOTED_COLUMNS[i] ? escapeCSV(v) : v).join(',');
console.log(EXPORT_HEADERS.join(','));
console.log(row);
"`

Expected: header line with 21 comma-separated column names, then a row where quoted text fields are wrapped in `"..."` and Quantity/Price/Total Value/Is Token/Is Foil/Created At/Updated At are bare — matching the pre-refactor output shape exactly.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "refactor: CSV export route reuses shared collection export helper"
```

---

## Task 3: Add the refresh-token encryption helper

**Files:**
- Create: `backend/utils/googleTokenCrypto.js`
- Test: `backend/__tests__/google-sheets-crypto.test.js`

- [ ] **Step 1: Write the failing test**

```js
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes, hex-encoded

const { encryptToken, decryptToken } = require('../utils/googleTokenCrypto');

describe('googleTokenCrypto', () => {
  test('round-trips a refresh token through encrypt then decrypt', () => {
    const plaintext = '1//0abcDEF_a-real-looking-google-refresh-token';
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  test('encrypting the same value twice produces different ciphertext (random IV)', () => {
    const a = encryptToken('same-token');
    const b = encryptToken('same-token');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe('same-token');
    expect(decryptToken(b)).toBe('same-token');
  });

  test('throws when GOOGLE_TOKEN_ENCRYPTION_KEY is missing', () => {
    const original = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    // Re-require in isolation so the module re-reads process.env
    jest.resetModules();
    const { encryptToken: encryptWithoutKey } = require('../utils/googleTokenCrypto');
    expect(() => encryptWithoutKey('x')).toThrow(/GOOGLE_TOKEN_ENCRYPTION_KEY/);
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original;
  });

  test('throws when the encrypted string is malformed', () => {
    expect(() => decryptToken('not-a-valid-encrypted-string')).toThrow(/Malformed/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest google-sheets-crypto -v`
Expected: FAIL with "Cannot find module '../utils/googleTokenCrypto'"

- [ ] **Step 3: Write the implementation**

```js
// backend/utils/googleTokenCrypto.js
//
// Encrypts the Google OAuth refresh token before it's stored in MongoDB
// (GoogleIntegration.refreshTokenEncrypted). No encryption-at-rest helper
// already existed in backend/utils/ (checked: utils/jwt.js and
// models/PasswordResetToken.js only use crypto.randomBytes for opaque IDs,
// never encrypt-then-decrypt a stored secret) — this is a new module using
// Node's built-in `crypto` with AES-256-GCM.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM

function getKey() {
  const keyHex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'GOOGLE_TOKEN_ENCRYPTION_KEY is not set. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters');
  }
  return key;
}

/**
 * Encrypt a plaintext string (the Google refresh token) for storage.
 * @param {string} plainText
 * @returns {string} "iv:authTag:ciphertext", all hex-encoded
 */
function encryptToken(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt a value produced by encryptToken().
 * @param {string} encryptedString
 * @returns {string} the original plaintext
 */
function decryptToken(encryptedString) {
  const key = getKey();
  const parts = String(encryptedString).split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted token (expected "iv:authTag:ciphertext")');
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptToken, decryptToken };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest google-sheets-crypto -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/utils/googleTokenCrypto.js backend/__tests__/google-sheets-crypto.test.js
git commit -m "feat: add AES-256-GCM encryption helper for stored Google refresh tokens"
```

---

## Task 4: Add the `GoogleIntegration` model

**Files:**
- Create: `backend/models/GoogleIntegration.js`

Follows the same field convention as `backend/models/Deck.js:4` (`userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }`), with a `unique: true` index since each user has at most one integration (mirrors the one-token-per-user shape of `backend/models/PasswordResetToken.js`).

- [ ] **Step 1: Write the model**

```js
// backend/models/GoogleIntegration.js
const mongoose = require('mongoose');

const googleIntegrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // AES-256-GCM encrypted "iv:authTag:ciphertext" — see utils/googleTokenCrypto.js.
  // Never store or return the plaintext refresh token.
  refreshTokenEncrypted: {
    type: String,
    required: true
  },
  // Set on first successful export; reused (not recreated) on every export after that.
  spreadsheetId: {
    type: String,
    default: null
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GoogleIntegration', googleIntegrationSchema);
```

- [ ] **Step 2: Sanity-check the model loads and enforces uniqueness**

Run:
```bash
cd backend && node -e "
const mongoose = require('mongoose');
const GoogleIntegration = require('./models/GoogleIntegration');
console.log('Model name:', GoogleIntegration.modelName);
console.log('Schema paths:', Object.keys(GoogleIntegration.schema.paths));
"
```
Expected: prints `Model name: GoogleIntegration` and a paths list including `userId`, `refreshTokenEncrypted`, `spreadsheetId`, `connectedAt`. (Uniqueness itself is exercised indirectly by the route tests in Task 8, which rely on `findOneAndUpdate({ userId }, ..., { upsert: true })` rather than duplicate inserts.)

- [ ] **Step 3: Commit**

```bash
git add backend/models/GoogleIntegration.js
git commit -m "feat: add GoogleIntegration model for per-user Google Sheets OAuth state"
```

---

## Task 5: Extend `ActivityLog` enums for Google Sheets activity

**Files:**
- Modify: `backend/models/ActivityLog.js:57-77`

The `action` enum (line 17-72) and `category` enum (line 74-77) are both closed lists — adding new activity types requires extending them here first, same as every prior feature's activity types (`export_json`/`export_csv`/`export` category already exist for the existing exports).

- [ ] **Step 1: Add new action + category values**

Current (`backend/models/ActivityLog.js:57-77`):

```js
      // Admin actions
      'user_create',
      'user_update',
      'user_delete',
      'user_role_change',
      'user_deactivate',
      'user_activate',
      'data_migrate',
      'maintenance_toggle',
      'settings_update',

      // Export actions
      'export_json',
      'export_csv',
      'data_export_gdpr'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: ['auth', 'collection', 'deck', 'wishlist', 'location', 'tag', 'admin', 'export']
  },
```

Replace with:

```js
      // Admin actions
      'user_create',
      'user_update',
      'user_delete',
      'user_role_change',
      'user_deactivate',
      'user_activate',
      'data_migrate',
      'maintenance_toggle',
      'settings_update',

      // Export actions
      'export_json',
      'export_csv',
      'data_export_gdpr',

      // Google Sheets integration actions
      'google_sheets_connect',
      'google_sheets_disconnect',
      'google_sheets_export'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: ['auth', 'collection', 'deck', 'wishlist', 'location', 'tag', 'admin', 'export', 'integration']
  },
```

- [ ] **Step 2: Verify the schema loads with the new enum values**

Run:
```bash
cd backend && node -e "
const ActivityLog = require('./models/ActivityLog');
const actionEnum = ActivityLog.schema.path('action').enumValues;
const categoryEnum = ActivityLog.schema.path('category').enumValues;
console.log(actionEnum.includes('google_sheets_export'));
console.log(categoryEnum.includes('integration'));
"
```
Expected: prints `true` then `true`.

- [ ] **Step 3: Commit**

```bash
git add backend/models/ActivityLog.js
git commit -m "feat: add Google Sheets action/category enums to ActivityLog"
```

---

## Task 6: Add activity loggers for Google Sheets actions

**Files:**
- Modify: `backend/middleware/activityLogger.js:221-224`

- [ ] **Step 1: Add the three new loggers next to the existing export loggers**

Current (`backend/middleware/activityLogger.js:221-224`):

```js
  // Export activities
  exportJson: createActivityLogger('export_json', 'export'),
  exportCsv: createActivityLogger('export_csv', 'export'),
  dataExportGdpr: createActivityLogger('data_export_gdpr', 'export'),
```

Replace with:

```js
  // Export activities
  exportJson: createActivityLogger('export_json', 'export'),
  exportCsv: createActivityLogger('export_csv', 'export'),
  dataExportGdpr: createActivityLogger('data_export_gdpr', 'export'),

  // Google Sheets integration activities
  googleSheetsConnect: createActivityLogger('google_sheets_connect', 'integration'),
  googleSheetsDisconnect: createActivityLogger('google_sheets_disconnect', 'integration'),
  googleSheetsExport: createActivityLogger('google_sheets_export', 'export'),
```

- [ ] **Step 2: Verify the loggers are exported**

Run:
```bash
cd backend && node -e "
const { activityLoggers } = require('./middleware/activityLogger');
console.log(typeof activityLoggers.googleSheetsConnect);
console.log(typeof activityLoggers.googleSheetsExport);
console.log(typeof activityLoggers.googleSheetsDisconnect);
"
```
Expected: prints `function` three times.

- [ ] **Step 3: Commit**

```bash
git add backend/middleware/activityLogger.js
git commit -m "feat: add activity loggers for Google Sheets connect/export/disconnect"
```

---

## Task 7: Add the `googleapis` dependency and the Sheets client wrapper

**Files:**
- Modify: `backend/package.json`
- Create: `backend/utils/googleSheetsClient.js`
- Test: `backend/__tests__/google-sheets-crypto.test.js` is unrelated; this task's only pure-function coverage is folded into Step 4 below (the rest of `googleSheetsClient` needs a mocked `googleapis`, which is exercised by the route tests in Tasks 8-11 rather than duplicated here).

- [ ] **Step 1: Get the current published version and pin it**

Run: `npm view googleapis version`
This prints the latest published version (e.g. `144.0.0`) at implementation time — use that exact value below instead of guessing, since whatever is written into this plan today will be stale by the time this deferred feature is built.

- [ ] **Step 2: Add the dependency to `backend/package.json`**

In `backend/package.json`, the `"dependencies"` block currently reads (alphabetical):

```json
  "dependencies": {
    "axios": "^1.6.0",
    "bcrypt": "^6.0.0",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^8.2.1",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^8.0.0",
    "node-cache": "^5.1.2",
    "node-cron": "^4.5.0",
    "nodemailer": "^6.10.1",
    "sharp": "^0.34.5"
  },
```

Add `"googleapis"` in alphabetical order (between `express-rate-limit` and `jsonwebtoken`), using the version from Step 1:

```json
  "dependencies": {
    "axios": "^1.6.0",
    "bcrypt": "^6.0.0",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^8.2.1",
    "googleapis": "^<version from npm view>",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^8.0.0",
    "node-cache": "^5.1.2",
    "node-cron": "^4.5.0",
    "nodemailer": "^6.10.1",
    "sharp": "^0.34.5"
  },
```

- [ ] **Step 3: Install it**

Run: `cd backend && npm install`
Expected: `googleapis` and its transitive deps appear in `backend/node_modules` and `backend/package-lock.json` is updated.

- [ ] **Step 4: Write the client wrapper**

```js
// backend/utils/googleSheetsClient.js
//
// Thin wrapper around the `googleapis` package. Isolating every googleapis
// call behind this module means route tests only need `jest.mock('googleapis')`
// once (see backend/__tests__/google-sheets-integration.test.js) instead of
// mocking it separately in every file that touches Sheets.

const { google } = require('googleapis');

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Build the Google consent-screen URL for the user to visit.
 * @param {string} state - opaque, server-verifiable state (carries the userId — see routes/googleSheets.js)
 * @returns {string}
 */
function getAuthUrl(state) {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent',      // force the consent screen so a refresh_token is issued even on reconnect
    scope: [SHEETS_SCOPE],
    state
  });
}

/**
 * Exchange an OAuth authorization code for tokens.
 * @param {string} code
 * @returns {Promise<{access_token: string, refresh_token?: string}>}
 */
async function exchangeCodeForTokens(code) {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function sheetsClientForRefreshToken(refreshToken) {
  const client = buildOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  // googleapis transparently exchanges the refresh token for a short-lived
  // access token on the first API call made with this client — no separate
  // "exchange" call is needed on our side.
  return google.sheets({ version: 'v4', auth: client });
}

/**
 * Create a new spreadsheet in the user's Drive and return its id.
 * @param {string} refreshToken - decrypted refresh token
 * @param {string} title
 * @returns {Promise<string>} spreadsheetId
 */
async function createSpreadsheet(refreshToken, title) {
  const sheets = sheetsClientForRefreshToken(refreshToken);
  const response = await sheets.spreadsheets.create({
    resource: { properties: { title } }
  });
  return response.data.spreadsheetId;
}

/**
 * Overwrite Sheet1 with a header row followed by data rows.
 * @param {string} refreshToken - decrypted refresh token
 * @param {string} spreadsheetId
 * @param {Array<string>} headerRow
 * @param {Array<Array<string|number>>} dataRows
 */
async function writeCollectionSheet(refreshToken, spreadsheetId, headerRow, dataRows) {
  const sheets = sheetsClientForRefreshToken(refreshToken);
  // Clear first so a shrinking collection doesn't leave stale rows behind.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Sheet1' });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    resource: { values: [headerRow, ...dataRows] }
  });
}

/**
 * Revoke a refresh token server-side (best-effort — callers should not
 * treat a failure here as fatal, since the token may already be revoked).
 * @param {string} refreshToken - decrypted refresh token
 */
async function revokeRefreshToken(refreshToken) {
  const client = buildOAuthClient();
  await client.revokeToken(refreshToken);
}

function spreadsheetUrl(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

module.exports = {
  SHEETS_SCOPE,
  getAuthUrl,
  exchangeCodeForTokens,
  createSpreadsheet,
  writeCollectionSheet,
  revokeRefreshToken,
  spreadsheetUrl
};
```

- [ ] **Step 5: Verify the pure function with no Google dependency**

Run:
```bash
cd backend && node -e "
const { spreadsheetUrl } = require('./utils/googleSheetsClient');
console.log(spreadsheetUrl('abc123') === 'https://docs.google.com/spreadsheets/d/abc123/edit');
"
```
Expected: prints `true`.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/utils/googleSheetsClient.js
git commit -m "feat: add googleapis dependency and Sheets API client wrapper"
```

---

## Task 8: Build the router — `GET /connect` and `GET /status`

**Files:**
- Create: `backend/routes/googleSheets.js`
- Create: `backend/__tests__/google-sheets-integration.test.js`

This introduces the shared test scaffolding (the `jest.mock('googleapis')` factory, `buildApp()`, and a minimal test-only `Card` model) that Tasks 9-11 build on.

Note on the test-only `Card` model: `Card` is defined inline in `backend/server.js` (`mongoose.model('Card', cardSchema)` at `backend/server.js:386`) and never exported — `backend/server.js` has no `module.exports` at all, so it cannot be safely `require()`'d in a test (it would try to boot the real HTTP server). The existing `backend/__tests__/deck-sharing.test.js:79-82` works around this for routes that don't need `Card` by passing `null` into `injectDependencies`. Since our export route *does* need to read real cards, this task defines a minimal local Mongoose model bound to the same `'cards'` collection name with just the fields the export path touches — this is new test infrastructure this feature requires, not present anywhere else in the test suite today.

- [ ] **Step 1: Write the failing tests for `/connect` and `/status`**

```js
// backend/__tests__/google-sheets-integration.test.js
process.env.JWT_SECRET = 'test-secret';
process.env.MULTI_USER_ENABLED = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/integrations/google-sheets/callback';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
process.env.FRONTEND_URL = 'http://localhost:3000';

jest.mock('googleapis', () => {
  const generateAuthUrl = jest.fn(() => 'https://accounts.google.com/mock-consent-url');
  const getToken = jest.fn(async (code) => ({
    tokens: { access_token: 'mock-access-token', refresh_token: `refresh-token-for-${code}` }
  }));
  const revokeToken = jest.fn(async () => ({}));
  const setCredentials = jest.fn();

  const OAuth2 = jest.fn().mockImplementation(() => ({
    generateAuthUrl,
    getToken,
    revokeToken,
    setCredentials
  }));

  const create = jest.fn(async () => ({ data: { spreadsheetId: 'mock-spreadsheet-id' } }));
  const clear = jest.fn(async () => ({}));
  const update = jest.fn(async () => ({}));

  const sheets = jest.fn(() => ({
    spreadsheets: { create, values: { clear, update } }
  }));

  return {
    google: { auth: { OAuth2 }, sheets },
    __googleMocks: { generateAuthUrl, getToken, revokeToken, setCredentials, create, clear, update }
  };
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GoogleIntegration = require('../models/GoogleIntegration');
const { encryptToken, decryptToken } = require('../utils/googleTokenCrypto');
const { EXPORT_HEADERS } = require('../utils/collectionExport');
const { __googleMocks } = require('googleapis');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
  jest.clearAllMocks();
});

// Card is defined inline in backend/server.js and never exported (server.js
// has no module.exports). This mirrors the same fields/collection name for
// the routes under test, which receive it via injectDependencies() exactly
// like the real Card model would be.
const testCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  set: String,
  setCode: String,
  collectorNumber: String,
  rarity: String,
  quantity: { type: Number, default: 1 },
  condition: { type: String, default: 'NM' },
  price: { type: Number, default: 0 },
  colors: [String],
  types: [String],
  manaCost: String,
  tags: [String],
  location: String,
  isToken: { type: Boolean, default: false },
  isFoil: { type: Boolean, default: false },
  scryfallId: String,
  imageUrl: String,
  oracleText: String
}, { timestamps: true });
const TestCard = mongoose.model('Card', testCardSchema, 'cards');

function makeToken(userId) {
  return jwt.sign({ userId: userId.toString(), role: 'editor' }, 'test-secret');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const { verifyToken } = require('../middleware/auth');
  app.use(verifyToken);
  const googleSheetsRouter = require('../routes/googleSheets');
  googleSheetsRouter.injectDependencies(TestCard);
  app.use('/api/integrations/google-sheets', googleSheetsRouter);
  return app;
}

describe('GET /api/integrations/google-sheets/connect', () => {
  test('returns a Google consent URL built with offline access and a signed state', async () => {
    const user = await User.create({ email: 'a@test.com', username: 'usera', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .get('/api/integrations/google-sheets/connect')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://accounts.google.com/mock-consent-url');
    expect(__googleMocks.generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
        state: expect.any(String)
      })
    );

    // The state must be a JWT that decodes back to this user's id.
    const call = __googleMocks.generateAuthUrl.mock.calls[0][0];
    const decoded = jwt.verify(call.state, 'test-secret');
    expect(decoded.userId).toBe(user._id.toString());
    expect(decoded.purpose).toBe('google-sheets-connect');
  });

  test('returns 401 without auth', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/integrations/google-sheets/connect');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/integrations/google-sheets/status', () => {
  test('reports not connected when no integration exists', async () => {
    const user = await User.create({ email: 'b@test.com', username: 'userb', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .get('/api/integrations/google-sheets/status')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, spreadsheetUrl: null });
  });

  test('reports connected with a spreadsheet URL once a spreadsheet exists', async () => {
    const user = await User.create({ email: 'c@test.com', username: 'userc', passwordHash: 'h' });
    await GoogleIntegration.create({
      userId: user._id,
      refreshTokenEncrypted: encryptToken('rt'),
      spreadsheetId: 'sheet-xyz'
    });
    const app = buildApp();

    const res = await request(app)
      .get('/api/integrations/google-sheets/status')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      connected: true,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-xyz/edit'
    });
  });

  test('reports connected but null spreadsheetUrl when connected but never exported', async () => {
    const user = await User.create({ email: 'c2@test.com', username: 'userc2', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: user._id, refreshTokenEncrypted: encryptToken('rt') });
    const app = buildApp();

    const res = await request(app)
      .get('/api/integrations/google-sheets/status')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: true, spreadsheetUrl: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: FAIL with "Cannot find module '../routes/googleSheets'"

- [ ] **Step 3: Write the router (connect + status only for now)**

```js
// backend/routes/googleSheets.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { getJwtSecret } = require('../utils/jwt');
const GoogleIntegration = require('../models/GoogleIntegration');
const { encryptToken, decryptToken } = require('../utils/googleTokenCrypto');
const googleSheetsClient = require('../utils/googleSheetsClient');
const { buildUserQuery } = require('../middleware/multiUser');
const { activityLoggers } = require('../middleware/activityLogger');
const { EXPORT_HEADERS, cardToExportRow } = require('../utils/collectionExport');

// Card model is defined in backend/server.js, not a standalone file.
// Injected when this router is mounted (see server.js, mirroring routes/decks.js).
let Card;
function injectDependencies(cardModel) {
  Card = cardModel;
}

const STATE_PURPOSE = 'google-sheets-connect';

// Start the OAuth flow. Encodes the requesting user's id in a short-lived
// signed "state" JWT, since Google's redirect back to /callback carries no
// Authorization header of its own.
router.get('/connect', requireAuth, activityLoggers.googleSheetsConnect, (req, res) => {
  const state = jwt.sign(
    { userId: req.user._id.toString(), purpose: STATE_PURPOSE },
    getJwtSecret(),
    { expiresIn: '10m' }
  );
  const url = googleSheetsClient.getAuthUrl(state);
  res.json({ url });
});

// Whether the current user has a connected Google Sheets integration, and
// the URL of their spreadsheet if one has been created yet.
router.get('/status', requireAuth, async (req, res) => {
  try {
    const integration = await GoogleIntegration.findOne({ userId: req.user._id });
    res.json({
      connected: !!integration,
      spreadsheetUrl: integration && integration.spreadsheetId
        ? googleSheetsClient.spreadsheetUrl(integration.spreadsheetId)
        : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
module.exports.injectDependencies = injectDependencies;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: PASS (5 tests: 2 for `/connect`, 3 for `/status`)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/googleSheets.js backend/__tests__/google-sheets-integration.test.js
git commit -m "feat: add Google Sheets connect and status routes"
```

---

## Task 9: Build the router — `GET /callback`

**Files:**
- Modify: `backend/routes/googleSheets.js`
- Modify: `backend/__tests__/google-sheets-integration.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `backend/__tests__/google-sheets-integration.test.js`:

```js
describe('GET /api/integrations/google-sheets/callback', () => {
  function makeState(userId) {
    return jwt.sign({ userId: userId.toString(), purpose: 'google-sheets-connect' }, 'test-secret', { expiresIn: '10m' });
  }

  test('exchanges the code, stores an encrypted refresh token, and redirects to settings', async () => {
    const user = await User.create({ email: 'd@test.com', username: 'userd', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .get('/api/integrations/google-sheets/callback')
      .query({ code: 'auth-code-123', state: makeState(user._id) });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/settings?googleSheets=connected');

    const integration = await GoogleIntegration.findOne({ userId: user._id });
    expect(integration).not.toBeNull();
    expect(integration.spreadsheetId).toBeNull();
    expect(decryptToken(integration.refreshTokenEncrypted)).toBe('refresh-token-for-auth-code-123');
  });

  test('redirects with an error when the state token is invalid', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/integrations/google-sheets/callback')
      .query({ code: 'auth-code-456', state: 'not-a-real-jwt' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/settings?googleSheets=error');
  });

  test('redirects with an error when code or state is missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/integrations/google-sheets/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/settings?googleSheets=error');
  });

  test('reconnecting overwrites the previously stored integration for that user', async () => {
    const user = await User.create({ email: 'e@test.com', username: 'usere', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: user._id, refreshTokenEncrypted: encryptToken('old-token'), spreadsheetId: 'old-sheet' });
    const app = buildApp();

    await request(app)
      .get('/api/integrations/google-sheets/callback')
      .query({ code: 'auth-code-789', state: makeState(user._id) });

    const integrations = await GoogleIntegration.find({ userId: user._id });
    expect(integrations).toHaveLength(1);
    expect(decryptToken(integrations[0].refreshTokenEncrypted)).toBe('refresh-token-for-auth-code-789');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: FAIL — `/callback` route doesn't exist yet (404s instead of the expected 302 redirects)

- [ ] **Step 3: Add the callback route**

In `backend/routes/googleSheets.js`, add after the `/status` route and before `module.exports`:

```js
// Google redirects the user's browser here directly — there is no
// Authorization header on this request, which is why /connect had to encode
// the user's id into the signed `state` param in the first place.
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/settings?googleSheets=error`);
  }

  let decoded;
  try {
    decoded = jwt.verify(state, getJwtSecret());
  } catch (err) {
    return res.redirect(`${frontendUrl}/settings?googleSheets=error`);
  }

  if (decoded.purpose !== STATE_PURPOSE) {
    return res.redirect(`${frontendUrl}/settings?googleSheets=error`);
  }

  try {
    const tokens = await googleSheetsClient.exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token when the consent screen is actually
      // shown (prompt=consent forces this on our side, but guard anyway).
      return res.redirect(`${frontendUrl}/settings?googleSheets=error`);
    }

    const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

    await GoogleIntegration.findOneAndUpdate(
      { userId: decoded.userId },
      { userId: decoded.userId, refreshTokenEncrypted, spreadsheetId: null, connectedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.redirect(`${frontendUrl}/settings?googleSheets=connected`);
  } catch (error) {
    console.error('Google Sheets OAuth callback failed:', error.message);
    return res.redirect(`${frontendUrl}/settings?googleSheets=error`);
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: PASS (9 tests total so far)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/googleSheets.js backend/__tests__/google-sheets-integration.test.js
git commit -m "feat: add Google Sheets OAuth callback route"
```

---

## Task 10: Build the router — `POST /export`

**Files:**
- Modify: `backend/routes/googleSheets.js`
- Modify: `backend/__tests__/google-sheets-integration.test.js`

This is the endpoint the spec calls out for explicit testing: the "not connected" 400 path, plus create-then-reuse spreadsheet behavior.

- [ ] **Step 1: Add the failing tests**

Append to `backend/__tests__/google-sheets-integration.test.js`:

```js
describe('POST /api/integrations/google-sheets/export', () => {
  test('returns 400 with a NOT_CONNECTED code when nothing is connected yet', async () => {
    const user = await User.create({ email: 'f@test.com', username: 'userf', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/integrations/google-sheets/export')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_CONNECTED');
  });

  test('creates a spreadsheet on first export and writes the header + card rows', async () => {
    const user = await User.create({ email: 'g@test.com', username: 'userg', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: user._id, refreshTokenEncrypted: encryptToken('real-refresh-token') });
    await TestCard.create({
      userId: user._id, name: 'Sol Ring', set: 'Commander 2021', setCode: 'C21',
      collectorNumber: '263', rarity: 'uncommon', quantity: 2, condition: 'NM',
      price: 1.5, colors: [], types: ['Artifact'], manaCost: '{1}', tags: ['staple'],
      location: 'Binder A', isToken: false, isFoil: false, scryfallId: 'abc123',
      imageUrl: 'https://img.example/sol-ring.jpg', oracleText: '{T}: Add {C}{C}.'
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/integrations/google-sheets/export')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://docs.google.com/spreadsheets/d/mock-spreadsheet-id/edit');
    expect(__googleMocks.create).toHaveBeenCalledTimes(1);
    expect(__googleMocks.update).toHaveBeenCalledTimes(1);

    const updateArgs = __googleMocks.update.mock.calls[0][0];
    expect(updateArgs.spreadsheetId).toBe('mock-spreadsheet-id');
    expect(updateArgs.resource.values[0]).toEqual(EXPORT_HEADERS);
    expect(updateArgs.resource.values[1][0]).toBe('Sol Ring');
    expect(updateArgs.resource.values[1][8]).toBe(3); // Total Value = price(1.5) * quantity(2)

    const stored = await GoogleIntegration.findOne({ userId: user._id });
    expect(stored.spreadsheetId).toBe('mock-spreadsheet-id');
  });

  test('reuses the stored spreadsheetId on a second export instead of creating a new one', async () => {
    const user = await User.create({ email: 'h@test.com', username: 'userh', passwordHash: 'h' });
    await GoogleIntegration.create({
      userId: user._id,
      refreshTokenEncrypted: encryptToken('real-refresh-token'),
      spreadsheetId: 'already-exists-id'
    });
    await TestCard.create({ userId: user._id, name: 'Forest', quantity: 1, price: 0, condition: 'NM' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/integrations/google-sheets/export')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://docs.google.com/spreadsheets/d/already-exists-id/edit');
    expect(__googleMocks.create).not.toHaveBeenCalled();
    expect(__googleMocks.clear).toHaveBeenCalledWith(expect.objectContaining({ spreadsheetId: 'already-exists-id' }));
  });

  test('only exports the requesting user\'s own cards', async () => {
    const owner = await User.create({ email: 'i@test.com', username: 'useri', passwordHash: 'h' });
    const other = await User.create({ email: 'j@test.com', username: 'userj', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: owner._id, refreshTokenEncrypted: encryptToken('rt') });
    await TestCard.create({ userId: owner._id, name: 'Owned Card', quantity: 1, price: 1, condition: 'NM' });
    await TestCard.create({ userId: other._id, name: 'Someone Elses Card', quantity: 1, price: 1, condition: 'NM' });
    const app = buildApp();

    await request(app)
      .post('/api/integrations/google-sheets/export')
      .set('Authorization', `Bearer ${makeToken(owner._id)}`);

    const updateArgs = __googleMocks.update.mock.calls[0][0];
    const rows = updateArgs.resource.values.slice(1); // drop header
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('Owned Card');
  });

  test('returns 401 without auth', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/integrations/google-sheets/export');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: FAIL — `/export` route doesn't exist yet (404s)

- [ ] **Step 3: Add the export route**

In `backend/routes/googleSheets.js`, add after the `/callback` route and before `module.exports`:

```js
router.post('/export', requireAuth, activityLoggers.googleSheetsExport, async (req, res) => {
  try {
    const integration = await GoogleIntegration.findOne({ userId: req.user._id });
    if (!integration) {
      return res.status(400).json({
        message: 'Google Sheets is not connected yet. Connect it first.',
        code: 'NOT_CONNECTED'
      });
    }

    const refreshToken = decryptToken(integration.refreshTokenEncrypted);

    let { spreadsheetId } = integration;
    if (!spreadsheetId) {
      spreadsheetId = await googleSheetsClient.createSpreadsheet(refreshToken, 'MTG Tracker Collection');
      integration.spreadsheetId = spreadsheetId;
      await integration.save();
    }

    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);
    const dataRows = cards.map(cardToExportRow);

    await googleSheetsClient.writeCollectionSheet(refreshToken, spreadsheetId, EXPORT_HEADERS, dataRows);

    res.json({ url: googleSheetsClient.spreadsheetUrl(spreadsheetId) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: PASS (14 tests total so far)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/googleSheets.js backend/__tests__/google-sheets-integration.test.js
git commit -m "feat: add Google Sheets export route (create-then-reuse spreadsheet)"
```

---

## Task 11: Build the router — `DELETE /` (disconnect)

**Files:**
- Modify: `backend/routes/googleSheets.js`
- Modify: `backend/__tests__/google-sheets-integration.test.js`

- [ ] **Step 1: Add the failing tests**

Append to `backend/__tests__/google-sheets-integration.test.js`:

```js
describe('DELETE /api/integrations/google-sheets', () => {
  test('revokes the token and deletes the stored integration', async () => {
    const user = await User.create({ email: 'k@test.com', username: 'userk', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: user._id, refreshTokenEncrypted: encryptToken('real-refresh-token') });
    const app = buildApp();

    const res = await request(app)
      .delete('/api/integrations/google-sheets')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(__googleMocks.revokeToken).toHaveBeenCalledWith('real-refresh-token');

    const remaining = await GoogleIntegration.findOne({ userId: user._id });
    expect(remaining).toBeNull();
  });

  test('is a no-op 200 when nothing is connected', async () => {
    const user = await User.create({ email: 'l@test.com', username: 'userl', passwordHash: 'h' });
    const app = buildApp();

    const res = await request(app)
      .delete('/api/integrations/google-sheets')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(__googleMocks.revokeToken).not.toHaveBeenCalled();
  });

  test('still deletes the local integration even if Google revocation fails', async () => {
    const user = await User.create({ email: 'm@test.com', username: 'userm', passwordHash: 'h' });
    await GoogleIntegration.create({ userId: user._id, refreshTokenEncrypted: encryptToken('already-revoked-token') });
    __googleMocks.revokeToken.mockRejectedValueOnce(new Error('invalid_token'));
    const app = buildApp();

    const res = await request(app)
      .delete('/api/integrations/google-sheets')
      .set('Authorization', `Bearer ${makeToken(user._id)}`);

    expect(res.status).toBe(200);
    const remaining = await GoogleIntegration.findOne({ userId: user._id });
    expect(remaining).toBeNull();
  });

  test('returns 401 without auth', async () => {
    const app = buildApp();
    const res = await request(app).delete('/api/integrations/google-sheets');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: FAIL — `DELETE /` route doesn't exist yet (404s)

- [ ] **Step 3: Add the disconnect route**

In `backend/routes/googleSheets.js`, add after the `/export` route and before `module.exports`:

```js
router.delete('/', requireAuth, activityLoggers.googleSheetsDisconnect, async (req, res) => {
  try {
    const integration = await GoogleIntegration.findOne({ userId: req.user._id });
    if (integration) {
      try {
        const refreshToken = decryptToken(integration.refreshTokenEncrypted);
        await googleSheetsClient.revokeRefreshToken(refreshToken);
      } catch (revokeError) {
        // Best-effort: the token may already be revoked on Google's side.
        // Don't block local disconnect on this.
        console.error('Failed to revoke Google token (continuing with local disconnect):', revokeError.message);
      }
      await GoogleIntegration.deleteOne({ userId: req.user._id });
    }
    res.json({ message: 'Google Sheets disconnected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest google-sheets-integration -v`
Expected: PASS (18 tests total)

- [ ] **Step 5: Run the full backend test suite to make sure nothing else broke**

Run: `cd backend && npx jest`
Expected: all suites PASS, including `collection-export-helper`, `google-sheets-crypto`, and `google-sheets-integration`

- [ ] **Step 6: Commit**

```bash
git add backend/routes/googleSheets.js backend/__tests__/google-sheets-integration.test.js
git commit -m "feat: add Google Sheets disconnect route"
```

---

## Task 12: Mount the router in `server.js` and add env var templates

**Files:**
- Modify: `backend/server.js` (near line 594-595)
- Modify: `backend/.env.local`
- Modify: `backend/.env.cloud`

- [ ] **Step 1: Mount the router**

Current (`backend/server.js:593-595`):

```js
// Deck folder routes
const deckFolderRoutes = require('./routes/deckFolders');
app.use('/api/deck-folders', deckFolderRoutes);
```

Add directly below it:

```js
// Deck folder routes
const deckFolderRoutes = require('./routes/deckFolders');
app.use('/api/deck-folders', deckFolderRoutes);

// Google Sheets export integration routes
const googleSheetsRoutes = require('./routes/googleSheets');
googleSheetsRoutes.injectDependencies(Card);
app.use('/api/integrations/google-sheets', googleSheetsRoutes);
```

- [ ] **Step 2: Add env var templates to `backend/.env.local`**

Current end of `backend/.env.local`:

```
# Daily.co video rooms (SpellTable-lite)
# Get free API key at https://dashboard.daily.co → Developers → API Keys
DAILY_API_KEY=
```

Append:

```

# Google Sheets export (optional) — see INSTALL.md "Google Sheets Export Setup"
# Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google-sheets/callback
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GOOGLE_TOKEN_ENCRYPTION_KEY=
# Base URL of the running frontend, used to redirect back after Google OAuth
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Add the same block to `backend/.env.cloud`**

Current end of `backend/.env.cloud`:

```
JWT_SECRET=your-secure-random-secret-here-change-this-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

Append:

```

# Google Sheets export (optional) — see INSTALL.md "Google Sheets Export Setup"
# Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google-sheets/callback
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GOOGLE_TOKEN_ENCRYPTION_KEY=
# Base URL of the running frontend, used to redirect back after Google OAuth
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 4: Verify the server still boots**

Run: `cd backend && node -e "require('./server.js')" &
sleep 2
curl -s http://localhost:5000/api/cards | head -c 200
kill %1`

(On Windows/PowerShell, start the server with `Start-Process` or just run `npm run dev` in one terminal and `curl http://localhost:5000/api/cards` in another, then stop it.)

Expected: server starts without throwing (no `Cannot find module` or route-mounting errors), and `/api/cards` responds (`[]` or existing cards).

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/.env.local backend/.env.cloud
git commit -m "feat: mount Google Sheets routes and add env var templates"
```

---

## Task 13: Frontend — Settings "Data" tab Connect/Disconnect UI

**Files:**
- Modify: `frontend/src/App.js` (state + handlers)
- Modify: `frontend/src/components/SettingsView.js:253-308` (Data tab)

There is no existing frontend test harness in this repo (`frontend/src/**/*.test.js` returns zero files) — this task is verified manually in Task 15, consistent with how the rest of the frontend is built.

- [ ] **Step 1: Add Google Sheets state and handlers to `frontend/src/App.js`**

`App()` currently calls `useToast();` at `frontend/src/App.js:125` and discards the result (comment: "Required for context availability; individual components consume toast via useToast()") — so `addToast` is **not** actually available inside `App()` today. Change that line to actually destructure it, since the new handlers below call `addToast` directly:

Current (`frontend/src/App.js:125`):
```js
  useToast(); // Required for context availability; individual components consume toast via useToast()
```

Replace with:
```js
  const { addToast } = useToast();
```

Also add the missing import at the top of `frontend/src/App.js` (it does not currently import this util — confirmed no `./utils/auth` import exists in the file):

```js
import { getAuthHeaders } from './utils/auth';
```

Near the existing `exportData` function (`frontend/src/App.js:571-589`), add:

```js
const [googleSheetsStatus, setGoogleSheetsStatus] = useState({ connected: false, spreadsheetUrl: null });

const refreshGoogleSheetsStatus = useCallback(async () => {
  try {
    const res = await axios.get(`${API_URL}/integrations/google-sheets/status`, { headers: getAuthHeaders() });
    setGoogleSheetsStatus(res.data);
  } catch (error) {
    console.error('Failed to load Google Sheets status:', error.message);
  }
}, []);

useEffect(() => {
  refreshGoogleSheetsStatus();
}, [refreshGoogleSheetsStatus]);

const connectGoogleSheets = async () => {
  try {
    const res = await axios.get(`${API_URL}/integrations/google-sheets/connect`, { headers: getAuthHeaders() });
    window.location.href = res.data.url; // hand off to Google's consent screen
  } catch (error) {
    addToast('Failed to start Google Sheets connection: ' + error.message, 'error');
  }
};

const disconnectGoogleSheets = async () => {
  try {
    await axios.delete(`${API_URL}/integrations/google-sheets`, { headers: getAuthHeaders() });
    setGoogleSheetsStatus({ connected: false, spreadsheetUrl: null });
    addToast('Google Sheets disconnected', 'info');
  } catch (error) {
    addToast('Failed to disconnect Google Sheets: ' + error.message, 'error');
  }
};

const exportToGoogleSheets = async () => {
  try {
    const res = await axios.post(`${API_URL}/integrations/google-sheets/export`, {}, { headers: getAuthHeaders() });
    setGoogleSheetsStatus(prev => ({ ...prev, spreadsheetUrl: res.data.url }));
    addToast(
      <>Exported to Google Sheets. <a href={res.data.url} target="_blank" rel="noopener noreferrer" className="underline">View Sheet</a></>,
      'success'
    );
  } catch (error) {
    if (error.response?.data?.code === 'NOT_CONNECTED') {
      addToast('Connect Google Sheets first (Settings → Data).', 'warning');
    } else {
      addToast('Failed to export to Google Sheets: ' + (error.response?.data?.message || error.message), 'error');
    }
  }
};
```

(`ToastProvider`/`useToast` is already imported at `frontend/src/App.js:15` — only the `getAuthHeaders` import and the `useToast()` destructuring fix above are new.)

- [ ] **Step 2: Read the OAuth redirect query param on the Settings route and show a toast**

In `frontend/src/App.js`, near where the `/settings` route element is rendered (`frontend/src/App.js:899-931`), add a `useEffect` (placed alongside the other top-level effects, e.g. near the `refreshGoogleSheetsStatus` effect from Step 1) that reacts to the `googleSheets` query param the backend's `/callback` route redirects with:

```js
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const googleSheetsResult = params.get('googleSheets');
  if (googleSheetsResult === 'connected') {
    addToast('Google Sheets connected!', 'success');
    refreshGoogleSheetsStatus();
    navigate('/settings', { replace: true }); // strip the query param
  } else if (googleSheetsResult === 'error') {
    addToast('Google Sheets connection failed. Please try again.', 'error');
    navigate('/settings', { replace: true });
  }
}, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
```

(`location` and `navigate` already come from `useLocation()`/`useNavigate()`, both already imported and used elsewhere in `App.js` per `frontend/src/App.js:3`.)

- [ ] **Step 3: Pass the new props to `SettingsView`**

In the `/settings` route element (`frontend/src/App.js:900-930`), add three props to the existing `<SettingsView ... />` call:

```jsx
<SettingsView
  settings={settings}
  updateSettings={updateSettings}
  resetSettings={resetSettings}
  formatPrice={formatPrice}
  locations={locations}
  availableTags={availableTags}
  locationStats={locationStats}
  newLocationName={newLocationName}
  setNewLocationName={setNewLocationName}
  newLocationDesc={newLocationDesc}
  setNewLocationDesc={setNewLocationDesc}
  editingLocation={editingLocation}
  handleCreateLocation={handleCreateLocation}
  handleUpdateLocation={handleUpdateLocation}
  cancelEditLocation={cancelEditLocation}
  startEditLocation={startEditLocation}
  handleDeleteLocation={handleDeleteLocation}
  handleToggleLocationIgnorePrice={handleToggleLocationIgnorePrice}
  newTagName={newTagName}
  setNewTagName={setNewTagName}
  handleCreateTag={handleCreateTag}
  handleDeleteTag={handleDeleteTag}
  handleToggleTagIgnorePrice={handleToggleTagIgnorePrice}
  generateQR={generateQR}
  qrDataUrls={qrDataUrls}
  setQrDataUrls={setQrDataUrls}
  setQRPreviewLocation={setQRPreviewLocation}
  setShowQRPreview={setShowQRPreview}
  setShowPrintLabels={setShowPrintLabels}
  googleSheetsStatus={googleSheetsStatus}
  onConnectGoogleSheets={connectGoogleSheets}
  onDisconnectGoogleSheets={disconnectGoogleSheets}
/>
```

- [ ] **Step 4: Add the Connect/Disconnect UI to the Data tab**

In `frontend/src/components/SettingsView.js`, add `googleSheetsStatus`, `onConnectGoogleSheets`, `onDisconnectGoogleSheets` to the destructured props list (line 7-15), add `FileSpreadsheet` to the `lucide-react` import (line 3), then insert a new block inside the `{settingsTab === 'data' && (...)}` section (`frontend/src/components/SettingsView.js:253-308`), directly after the closing `</div>` of the stats grid (line 275) and before the existing `<div className="flex flex-wrap gap-3">` button row (line 276):

```jsx
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                <FileSpreadsheet size={18} /> Google Sheets Export
              </h3>
              <p className="text-white/60 text-sm mb-3">
                Push a live snapshot of your collection to a Google Sheet in your own Google Drive.
              </p>
              {googleSheetsStatus.connected ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-green-400 text-sm font-medium">Connected</span>
                  {googleSheetsStatus.spreadsheetUrl && (
                    <a
                      href={googleSheetsStatus.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 text-sm underline"
                    >
                      View Sheet
                    </a>
                  )}
                  <button
                    onClick={onDisconnectGoogleSheets}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConnectGoogleSheets}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition text-sm flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} /> Connect Google Sheets
                </button>
              )}
            </div>
```

- [ ] **Step 5: Manual verification**

Run `npm start` in `frontend/` and `npm run dev` in `backend/` (per this project's existing dev workflow), navigate to Settings → Data tab, and confirm:
- With no `GoogleIntegration` in the DB for the logged-in user: a green "Connect Google Sheets" button renders.
- (Full OAuth round-trip requires real Google Cloud credentials — covered by the manual checklist in Task 15.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.js frontend/src/components/SettingsView.js
git commit -m "feat: add Google Sheets connect/disconnect UI to Settings Data tab"
```

---

## Task 14: Frontend — "Export to Google Sheets" button in the Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.js:1-178`

- [ ] **Step 1: Add props and the icon import**

In `frontend/src/components/Sidebar.js`, add `FileSpreadsheet` to the `lucide-react` import list (line 3-37), and add two new props to the `Sidebar` function signature (line 39-60): `googleSheetsConnected` and `onExportGoogleSheets`.

- [ ] **Step 2: Add the action item, shown only when connected**

Current (`frontend/src/components/Sidebar.js:144-178`):

```js
  const actionItems = [
    {
      label: isImporting ? 'Importing...' : 'Import',
      icon: Upload,
      onClick: () => fileInputRef.current?.click(),
      disabled: isImporting,
      color: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      label: 'Export JSON',
      icon: Download,
      onClick: onExportJSON,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Export CSV',
      icon: Download,
      onClick: onExportCSV,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Update Prices',
      icon: RefreshCw,
      onClick: onUpdatePrices,
      disabled: loading,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'Fetch Card Text',
      icon: RefreshCw,
      onClick: onFetchCardText,
      disabled: loading,
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
  ];
```

Replace with:

```js
  const actionItems = [
    {
      label: isImporting ? 'Importing...' : 'Import',
      icon: Upload,
      onClick: () => fileInputRef.current?.click(),
      disabled: isImporting,
      color: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      label: 'Export JSON',
      icon: Download,
      onClick: onExportJSON,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Export CSV',
      icon: Download,
      onClick: onExportCSV,
      color: 'bg-green-600 hover:bg-green-700'
    },
    ...(googleSheetsConnected ? [{
      label: 'Export to Google Sheets',
      icon: FileSpreadsheet,
      onClick: onExportGoogleSheets,
      color: 'bg-green-600 hover:bg-green-700'
    }] : []),
    {
      label: 'Update Prices',
      icon: RefreshCw,
      onClick: onUpdatePrices,
      disabled: loading,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'Fetch Card Text',
      icon: RefreshCw,
      onClick: onFetchCardText,
      disabled: loading,
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
  ];
```

- [ ] **Step 3: Pass the new props from `App.js`**

In `frontend/src/App.js`, in the `<Sidebar ... />` call (`frontend/src/App.js:770-797`), add two props next to the existing `onExportCSV`:

```jsx
        onExportJSON={() => exportData('json')}
        onExportCSV={() => exportData('csv')}
        googleSheetsConnected={googleSheetsStatus.connected}
        onExportGoogleSheets={exportToGoogleSheets}
```

- [ ] **Step 4: Manual verification**

With a `GoogleIntegration` document seeded for the test user (e.g. via `mongosh` or the Settings UI from Task 13), confirm the "Export to Google Sheets" button appears in the Sidebar action list; with none, confirm it's absent. Click it and confirm a toast with a "View Sheet" link appears once the backend export route returns.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.js frontend/src/App.js
git commit -m "feat: show Export to Google Sheets action in Sidebar once connected"
```

---

## Task 15: Documentation — `INSTALL.md` Google Cloud OAuth setup section

**Files:**
- Modify: `INSTALL.md`

`INSTALL.md`'s existing structure (checked before writing this task) uses `###`-level subsections under "## Additional Documentation" style headers with numbered steps, bold labels, and fenced code blocks (see the "MongoDB (Choose One)" and "Sharing with Friends" sections for the established style). The new section follows that same pattern and is placed after "Sharing with Friends" (`INSTALL.md:283-328`) and before "Additional Documentation" (`INSTALL.md:329`), since it's an optional advanced-setup step like MongoDB Atlas rather than a core install step.

- [ ] **Step 1: Insert the new section**

In `INSTALL.md`, after the "Image Caching Feature" subsection (ends at line 328) and before `## Additional Documentation` (line 329), insert:

```markdown
## Google Sheets Export Setup (Optional)

Want to push your collection to a live Google Sheet instead of just downloading a CSV? This requires a one-time Google Cloud setup by whoever hosts the app.

### 1. Create a Google Cloud Project

**Console:** https://console.cloud.google.com/

1. Create a new project (or reuse an existing one)
2. Enable the **Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable

### 2. Create OAuth 2.0 Credentials

**Console:** https://console.cloud.google.com/apis/credentials

1. Click "Create Credentials" → "OAuth client ID"
2. If prompted, configure the OAuth consent screen first:
   - User type: **External** (unless using a Google Workspace account)
   - Scopes: add `https://www.googleapis.com/auth/spreadsheets`
   - Test users: add your own Google account (required while the app is in "Testing" publishing status)
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:5000/api/integrations/google-sheets/callback` (match `GOOGLE_REDIRECT_URI` below — update the host/port if your backend runs elsewhere)
5. Save the generated **Client ID** and **Client Secret**

### 3. Configure Backend Environment

Add to `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google-sheets/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=generate-with-command-below
FRONTEND_URL=http://localhost:3000
```

Generate `GOOGLE_TOKEN_ENCRYPTION_KEY` (used to encrypt the stored refresh token at rest):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Connect and Export

1. Start the app and go to **Settings → Data**
2. Click **Connect Google Sheets** and approve access on Google's consent screen
3. Click **Export to Google Sheets** (Sidebar) — this creates a spreadsheet in your Google Drive on first use, and overwrites it with a fresh snapshot on every export after that
4. Use **Disconnect** in Settings → Data to revoke access and delete the stored token

**Note:** While your OAuth consent screen is in "Testing" status (the default until you submit it for Google verification), only the test users you added in Step 2 can connect. This is fine for a self-hosted personal-use app.
```

- [ ] **Step 2: Proofread against the rendered file**

Run: `cd "d:\Card Tracker\mtg-tracker" && node -e "console.log(require('fs').readFileSync('INSTALL.md','utf8').includes('Google Sheets Export Setup'))"`
Expected: prints `true`

- [ ] **Step 3: Commit**

```bash
git add INSTALL.md
git commit -m "docs: add Google Sheets export OAuth setup instructions to INSTALL.md"
```

---

## Task 16: Manual end-to-end verification (real Google account required)

**Files:** none — this is a verification pass, not a code change.

Automated tests mock `googleapis` entirely (Tasks 8-11), so nothing in the automated suite exercises a real Google OAuth round-trip or a real Sheets API write. Before considering this feature done, run through this checklist once against a real Google Cloud project:

- [ ] **Step 1:** Follow `INSTALL.md`'s new "Google Sheets Export Setup" section end-to-end with a real Google Cloud project and a personal Google account added as a test user.
- [ ] **Step 2:** Start both servers (`backend/npm run dev`, `frontend/npm start`), log in, and go to Settings → Data. Confirm "Connect Google Sheets" is shown (not yet connected).
- [ ] **Step 3:** Click "Connect Google Sheets". Confirm it redirects to a real Google consent screen scoped to Sheets only (not full Drive), and that approving it redirects back to `/settings` with a "Google Sheets connected!" toast, and the Data tab now shows "Connected".
- [ ] **Step 4:** Go to the Collection view, click "Export to Google Sheets" in the Sidebar. Confirm a new spreadsheet appears in your real Google Drive titled "MTG Tracker Collection", with a header row matching the 21 CSV columns and one row per card in your collection.
- [ ] **Step 5:** Add/remove a card, export again. Confirm the *same* spreadsheet (same URL/ID) is overwritten rather than a second spreadsheet being created, and stale rows from removed cards are gone.
- [ ] **Step 6:** Click "Disconnect" in Settings → Data. Confirm the Data tab reverts to "Connect Google Sheets", and (optionally) check https://myaccount.google.com/permissions to confirm the app's access was revoked.
- [ ] **Step 7:** Click "Export to Google Sheets" again without reconnecting (if the button is still visible from stale state) or hit `POST /api/integrations/google-sheets/export` directly — confirm a 400 with `NOT_CONNECTED` and that the frontend shows the "Connect Google Sheets first" toast rather than crashing.
- [ ] **Step 8:** Confirm `backend/cached-images/`-style secrets aren't leaked: check the `GoogleIntegration` document in MongoDB directly (`mongosh` → `db.googleintegrations.find()`) and confirm `refreshTokenEncrypted` is the `iv:authTag:ciphertext` hex format, never the raw Google token.
