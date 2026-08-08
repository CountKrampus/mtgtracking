# Google Sheets Export — Design

**Status: deferred.** Not scheduled for implementation now — this spec exists so the feature is scoped and ready to build quickly whenever it's wanted. Nothing here should be built until explicitly requested.

## Problem / Goal

One-way, on-demand export: push the current collection to a Google Sheet, so it can be shared read-only, pivoted/analyzed in Sheets, or used as an external backup. This is the same data the existing CSV export already produces, just delivered to a live Sheet instead of a downloaded file.

## Non-goals

- No import (Sheets → collection) and no bidirectional sync — explicitly out of scope per the export-only decision. If import is wanted later, it's a separate spec (different auth-write-path and conflict-handling concerns).
- No auto-sync/scheduling — user-triggered only ("Export to Google Sheets" button), matching how JSON/CSV export already work.
- No multi-sheet/tab organization — a single sheet/tab per export, overwritten each time (see Design).

## Design

### Auth: Google OAuth (per-user), not a service account

A service account would either require the user to manually share a sheet with a robot email (clunky) or force all exports into sheets owned by the app's own Google account (wrong ownership model for a self-hosted personal tool). Per-user OAuth means the exported sheet lives in *the user's own* Google Drive, which matches how CSV/JSON export already hand the user their own file.

1. Requires a Google Cloud project + OAuth client credentials (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `backend/.env`) — a one-time manual setup step for whoever deploys this, documented in `INSTALL.md` alongside the existing MongoDB/email setup instructions.
2. `googleapis` npm package added as a new backend dependency.
3. New route `GET /api/integrations/google-sheets/connect` starts the OAuth flow (redirect to Google's consent screen, scope limited to `https://www.googleapis.com/auth/spreadsheets` — sheet access only, not full Drive).
4. Callback route stores the refresh token on a new `GoogleIntegration` model: `{ userId, refreshToken (encrypted at rest), connectedAt }`.
5. "Disconnect" revokes and deletes the stored token (Settings UI).

### Export flow

New route `POST /api/integrations/google-sheets/export`:
1. Look up the user's stored refresh token; if none, respond `400` telling the frontend to trigger the connect flow first.
2. Exchange the refresh token for a short-lived access token via `googleapis`.
3. If this is the user's first export, create a new Spreadsheet via the Sheets API and store its `spreadsheetId` on `GoogleIntegration`; otherwise reuse the stored one.
4. Clear the existing sheet contents and write the same 21-column header + row data the CSV export already produces (`Name, Set, Set Code, Collector Number, Rarity, Quantity, Condition, Price, Total Value, Colors, Types, Mana Cost, Tags, Location, Is Token, Is Foil, Scryfall ID, Image URL, Oracle Text, Created At, Updated At` — reuse the exact field-mapping logic from `GET /api/export/csv` in `server.js` rather than duplicating it; extract that mapping into a shared helper both routes call).
5. Return the sheet's URL so the frontend can show a "View Sheet" link.

Overwrite-on-every-export (rather than append) keeps the model simple and matches "snapshot" framing — no versioning/history inside the sheet itself.

### Frontend

- Settings: "Connect Google Sheets" button (starts OAuth) → once connected, shows "Export to Google Sheets" button next to the existing Export JSON/CSV buttons in the Collection header, plus a "Disconnect" option.
- After export, toast/link to the sheet (reusing the existing `ToastContext`).

### Data model changes

- New `GoogleIntegration` model: `{ userId, refreshToken (encrypted), spreadsheetId, connectedAt }`.
- `refreshToken` encrypted at rest (reuse whatever encryption helper the codebase already has for sensitive stored values — check `utils/` at implementation time; if none exists, Node's built-in `crypto` with a key from `.env` is sufficient for a self-hosted single-tenant app).

## Testing

- Unit test for the shared field-mapping helper (extracted from CSV export) — one source of truth, tested once, used by both routes.
- Route tests with a mocked `googleapis` client: connect flow stores a token, export flow creates-then-reuses a spreadsheet ID, disconnect clears the stored integration.
- Test the "not connected yet" 400 path explicitly, since it's the first thing every new user hits.
