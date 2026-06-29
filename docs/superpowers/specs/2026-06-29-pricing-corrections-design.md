# Pricing Corrections UI — Design Spec

**Goal:** Let users with reputation ≥ 50 flag incorrect card prices for admin review. Admins dismiss or resolve flags (triggering a price refresh).

---

## Model

### `backend/models/PriceFlag.js`

```js
{
  cardId:      { type: ObjectId, ref: 'Card', required: true },
  flaggedBy:   { type: ObjectId, ref: 'User', required: true },
  reason:      { type: String, maxlength: 300, default: '' },
  status:      { type: String, enum: ['pending','resolved','dismissed'], default: 'pending' },
  resolvedBy:  { type: ObjectId, ref: 'User', default: null },
  resolvedAt:  { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now }
}
```

Compound index: `{ cardId: 1, flaggedBy: 1 }` — used by the duplicate-flag check.

---

## Backend Routes

### `POST /api/cards/:id/flag-price`

Added to `backend/routes/cards.js`.

- Middleware: `requireAuth`
- Check `req.user.reputation >= 50` → 403 if not.
- Check no existing `PriceFlag` with `{ cardId: id, flaggedBy: req.user._id, status: 'pending' }` → 409 "You already have a pending flag for this card."
- Create and save PriceFlag. Return 201 with the new flag.

### `GET /api/admin/price-flags`

Added to `backend/routes/admin.js`.

- Middleware: `requireAuth`, then role check `['admin','moderator']`.
- Query param `status` (default `pending`; accepts `pending`, `resolved`, `dismissed`, `all`).
- Populate `cardId` (name, set, price) and `flaggedBy` (username, reputation).
- Return array sorted by `createdAt` ascending (oldest first).

### `PUT /api/admin/price-flags/:id`

Added to `backend/routes/admin.js`.

- Middleware: `requireAuth`, role check `['admin','moderator']`.
- Body: `{ action: 'resolve' | 'dismiss' }`.
- Set `status`, `resolvedBy: req.user._id`, `resolvedAt: new Date()`.
- If `action === 'resolve'`: trigger price refresh for the card by calling the existing price-update logic (same as `POST /api/cards/:cardId/update-price?force=true`) internally.
- Write a `ModerationHistory` entry: `{ actionType: 'price_update', actionDetails: { flagId, cardId, action }, performedBy: req.user._id }`.
- Return updated flag.

---

## Frontend

### Flag icon in CollectionView

In `frontend/src/components/CollectionView.js`, in the card table's Actions column:

- Render a `<Flag size={16} />` icon button (orange, `text-orange-400`) only when `currentUser?.reputation >= 50`.
- Clicking opens `PriceFlagModal` (inline component defined above CollectionView — not inside it).
- `PriceFlagModal` props: `card`, `onClose`, `onSubmit`.
  - Contains a `<textarea>` (optional reason, 300 char max with counter) and Submit / Cancel buttons.
  - On submit: `POST /api/cards/:id/flag-price` with `{ reason }`. Show inline success message or error (409 = "already flagged").

### `frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js`

New file. Fetches `GET /api/admin/price-flags?status=pending` on mount.

Table columns: Card Name | Set | Current Price | Flagged By (rep) | Reason | Flagged At | Actions.

Actions: **Resolve** (green button — triggers price refresh) and **Dismiss** (gray button). Both call `PUT /api/admin/price-flags/:id` and refresh the list.

Add tab to the existing data-pricing section in `AdminPanel.js`: label "Price Flags", badge showing pending count.

---

## File Changes

| File | Action |
|------|--------|
| `backend/models/PriceFlag.js` | New model |
| `backend/routes/cards.js` | Add `POST /:id/flag-price` |
| `backend/routes/admin.js` | Add `GET /price-flags` and `PUT /price-flags/:id` |
| `frontend/src/components/CollectionView.js` | Add flag icon + `PriceFlagModal` (defined above CollectionView) |
| `frontend/src/components/admin/data-pricing/PriceCorrectionsTab.js` | New component |
| `frontend/src/components/admin/AdminPanel.js` | Add Price Flags tab to data-pricing section |

---

## Testing

- `POST /flag-price` with rep < 50 → 403
- `POST /flag-price` twice same card → 409
- `POST /flag-price` with rep ≥ 50 → 201
- `GET /price-flags` unauthenticated → 401
- `GET /price-flags` non-mod → 403
- `PUT /price-flags/:id` resolve → status becomes 'resolved', price refresh triggered
- `PUT /price-flags/:id` dismiss → status becomes 'dismissed', no price refresh
