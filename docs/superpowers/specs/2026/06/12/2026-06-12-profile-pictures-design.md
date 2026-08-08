# Profile Pictures (Avatars) Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Overview

Users can set a profile picture that appears on their main profile, forum profile, forum posts, leaderboard, hover cards, and chat messages. Two avatar sources are supported: a user-uploaded photo (with in-browser circular crop) and a selection of MTG-themed preset SVG avatars (mana symbols and planeswalker silhouettes). A colour-initial fallback is shown when no avatar is set.

---

## Data Model

### Modified: `User`

Add one field:

```javascript
avatarUrl: { type: String, default: '' }
```

Value is one of:
- `''` — no avatar set; fallback to colour-initial circle
- `/api/users/avatar/<uuid>.jpg` — user-uploaded file path
- `preset:<id>` — preset identifier (e.g. `preset:mana-blue`, `preset:jace`)

### Modified: `ForumPost`

Add one denormalized field (set at creation time, same pattern as `authorUsername`):

```javascript
authorAvatarUrl: { type: String, default: '' }
```

This avoids N+1 lookups when rendering thread views with many posts.

---

## Storage

- Uploaded avatars stored at `backend/user-avatars/<uuid>.jpg`
- Directory created on server startup if it doesn't exist
- Added to `.gitignore` (never committed)
- Files named by UUID (no username in filename — prevents guessing)
- Old file deleted from disk when user uploads a new one or removes their avatar
- Preset avatars are frontend-only SVG strings in `frontend/src/components/avatars/presets.js` — no server storage

---

## API Routes

### New

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/users/me/avatar` | requireAuth | Upload avatar image (multipart/form-data, field: `image`) |
| `DELETE` | `/api/users/me/avatar` | requireAuth | Remove avatar, revert to fallback |
| `GET` | `/api/users/avatar/:filename` | public | Serve avatar file from `backend/user-avatars/` |

**`POST /api/users/me/avatar` details:**
- Accepts JPEG, PNG, WebP only (validated by mimetype)
- Max 2MB (enforced by multer `limits.fileSize`)
- Saves as `<uuid>.jpg` in `backend/user-avatars/`
- Deletes previous uploaded file from disk if it existed
- Updates `User.avatarUrl` to `/api/users/avatar/<uuid>.jpg`
- Returns `{ avatarUrl }`

**`DELETE /api/users/me/avatar` details:**
- If `User.avatarUrl` starts with `/api/users/avatar/`, deletes the file from disk
- Sets `User.avatarUrl = ''`
- Returns `{ avatarUrl: '' }`

**`GET /api/users/avatar/:filename` details:**
- Serves static file from `backend/user-avatars/`
- `Cache-Control: public, max-age=31536000` (1-year cache)
- Returns 404 if file not found

### Modified

**`PUT /api/users/me`** — already handles privacy updates. Extended to also accept `avatarUrl` when value is a preset identifier (starts with `preset:`). Uploaded avatar changes must go through `POST /api/users/me/avatar`.

**`GET /api/users/profile/:username`** — add `avatarUrl` to response.

**`GET /api/forum/users/:username/activity`** — add `avatarUrl` to response.

---

## Frontend Components

### New: `frontend/src/components/avatars/UserAvatar.js`

Single shared avatar component used everywhere. Replaces the duplicated `getAvatarColor` pattern.

**Props:** `{ username, avatarUrl, size }`

**Size map:**
- `sm` → 28×28px (inline post author)
- `md` → 40×40px (leaderboard, hover card)
- `lg` → 72×72px (profile hero)

**Render logic:**
1. If `avatarUrl` starts with `/api/users/avatar/` → `<img src={avatarUrl} className="rounded-full object-cover" />`
2. If `avatarUrl` starts with `preset:` → look up SVG in `presets.js`, render inline SVG in a circle
3. Otherwise → colour-initial fallback (existing `getAvatarColor` logic, first letter of username)

### New: `frontend/src/components/avatars/presets.js`

Exports array of preset objects:

```javascript
export const AVATAR_PRESETS = [
  // Mana symbols (7)
  { id: 'mana-white',     label: 'White Mana',     category: 'mana',        svg: '...' },
  { id: 'mana-blue',      label: 'Blue Mana',      category: 'mana',        svg: '...' },
  { id: 'mana-black',     label: 'Black Mana',     category: 'mana',        svg: '...' },
  { id: 'mana-red',       label: 'Red Mana',       category: 'mana',        svg: '...' },
  { id: 'mana-green',     label: 'Green Mana',     category: 'mana',        svg: '...' },
  { id: 'mana-colorless', label: 'Colorless Mana', category: 'mana',        svg: '...' },
  { id: 'mana-multi',     label: 'Multicolor',     category: 'mana',        svg: '...' },
  // Planeswalker silhouettes (10)
  { id: 'jace',     label: 'Jace',     category: 'planeswalker', svg: '...' },
  { id: 'liliana',  label: 'Liliana',  category: 'planeswalker', svg: '...' },
  { id: 'chandra',  label: 'Chandra',  category: 'planeswalker', svg: '...' },
  { id: 'nissa',    label: 'Nissa',    category: 'planeswalker', svg: '...' },
  { id: 'gideon',   label: 'Gideon',   category: 'planeswalker', svg: '...' },
  { id: 'ajani',    label: 'Ajani',    category: 'planeswalker', svg: '...' },
  { id: 'teferi',   label: 'Teferi',   category: 'planeswalker', svg: '...' },
  { id: 'elspeth',  label: 'Elspeth',  category: 'planeswalker', svg: '...' },
  { id: 'sorin',    label: 'Sorin',    category: 'planeswalker', svg: '...' },
  { id: 'karn',     label: 'Karn',     category: 'planeswalker', svg: '...' },
];
```

SVGs are self-contained 64×64 viewBox circular designs. The implementer creates these during the task:

- **Mana symbols:** Filled circle in the mana colour (white=#f9fafb, blue=#3b82f6, black=#1f2937, red=#ef4444, green=#22c55e, colorless=#6b7280, multi=#eab308), with the MTG mana letter (W/U/B/R/G/C/M) centred in white or dark contrast text.
- **Planeswalker silhouettes:** Dark purple/indigo filled circle with a simple white filled path silhouette for each character — these should be recognisable outlines, not detailed art. Each silhouette should be unique (Jace: hunched robed figure; Liliana: flowing hair arched back; Chandra: flame above head; Nissa: pointed elf ears and staff; Gideon: broad-shouldered standing figure; Ajani: leonin mane; Teferi: bald with staff; Elspeth: armoured with sword; Sorin: vampire cape; Karn: stocky metallic golem).

### New: `frontend/src/components/avatars/AvatarPicker.js`

Modal component opened from Account Settings. Two tabs:

**Upload tab:**
1. "Choose photo" button → `<input type="file" accept="image/*">` (max 2MB enforced client-side, shows error if exceeded)
2. Selected image loads into `react-image-crop` — circular crop mask, aspect ratio locked 1:1, min size 100×100px
3. "Save" button: canvas renders crop at 200×200px → `toBlob('image/jpeg', 0.85)` → `FormData` → `POST /api/users/me/avatar`
4. Avatar preview updates; modal closes on success

**Presets tab:**
- Grid layout, two sections: "Mana Symbols" (7) and "Planeswalkers" (10)
- Each preset is a clickable 64×64px circle — clicking calls `PUT /api/users/me` with `{ avatarUrl: 'preset:<id>' }` and closes modal
- Selected preset gets a purple ring indicator

**Bottom of both tabs:**
- "Remove photo" text button → `DELETE /api/users/me/avatar`

### Modified components (swap `getAvatarColor` for `<UserAvatar>`)

| File | Change |
|---|---|
| `frontend/src/components/Forum/ForumThreadView.js` | Replace colour-initial divs with `<UserAvatar size="sm">` (post rows) and `<UserAvatar size="md">` (OP, best-answer card) |
| `frontend/src/components/Forum/ForumLeaderboard.js` | Replace colour-initial div with `<UserAvatar size="md">` |
| `frontend/src/components/Forum/UserHoverCard.js` | Replace colour-initial div with `<UserAvatar size="md">` |
| `frontend/src/components/UserProfile.js` | Replace colour-initial div with `<UserAvatar size="lg">` in hero |
| `frontend/src/components/Chat.js` | Replace colour-initial div with `<UserAvatar size="sm">` |
| `frontend/src/components/auth/AccountSettings.js` | Add avatar preview + "Change" button that opens `AvatarPicker` |

### New: `frontend/src/components/Forum/ForumProfile.js`

Standalone page at `/forum/u/:username` using Layout A (hero + two-column). Hero uses `<UserAvatar size="lg">`. Fetches `GET /api/forum/users/:username/activity` which now includes `avatarUrl`. Link from main profile (`/u/:username`) to forum profile.

---

## Forum Route Changes

### `POST /api/forum/threads` and `POST /api/forum/posts`

Set `authorAvatarUrl: req.user.avatarUrl || ''` when creating threads/posts (alongside existing `authorUsername`).

### `GET /api/forum/threads/:id`

The batch author enrichment already fetches `User` docs. Add `avatarUrl` to the selected fields so it can override the denormalized value if the user has updated their avatar since posting.

---

## New Package

`react-image-crop` — added to `frontend/package.json`.

---

## Out of Scope

- Animated GIF avatars
- Avatar moderation / admin removal (admin can deactivate the user account if needed)
- Avatar history / reverting to previous upload
- Gravatar integration
- Resizing/optimising existing uploaded avatars retroactively
