# Price-Flag Resolution Feedback — Design Spec

**Feature #44** — Notify the user who submitted a price correction flag when an admin resolves or dismisses it.

---

## Problem

When a user submits a price correction flag via the Flag button in CollectionView, they receive no feedback when an admin acts on it. The `PUT /api/admin/price-flags/:id` route updates the flag status and logs a ModerationHistory entry but never contacts the submitter. Users have no way to know whether their flag was accepted (price refreshed) or dismissed.

---

## Goal

Fire an in-app notification to the flag submitter when their flag is resolved or dismissed. The notification appears in the notification bell like any other. Discord DM delivery is handled by feature #50 (Discord DM notification prefs) — this spec only covers creating and firing the notification.

---

## Non-Goals

- Email notification — out of scope
- Showing resolution details in the PriceCorrectionsTab admin UI — already visible there
- Letting submitters appeal a dismissal

---

## Data Model

### `Notification` — add `price_flag_resolved` type

The existing `type` enum in `backend/models/Notification.js` gets one new value:

```
'price_flag_resolved'
```

The `fromUserId` field is optional on this type (the resolving moderator's identity is not shown to the submitter — only the outcome matters). `cardId` is set so the frontend can link to the card.

Notification content strings:
- **Resolved**: `"Your price correction for [Card Name] was accepted and the price has been updated."`
- **Dismissed**: `"Your price correction for [Card Name] was reviewed and dismissed."`

---

## Backend

### `PUT /api/admin/price-flags/:id` — `backend/routes/admin.js`

After saving the flag and creating ModerationHistory, fire the notification:

```js
const card = await Card.findById(flag.cardId).select('name');
const cardName = card?.name ?? 'Unknown Card';
const content = action === 'resolve'
  ? `Your price correction for ${cardName} was accepted and the price has been updated.`
  : `Your price correction for ${cardName} was reviewed and dismissed.`;

await Notification.create({
  userId: flag.flaggedBy,
  type: 'price_flag_resolved',
  cardId: flag.cardId,
  content,
});
```

The card is already fetched earlier in the resolve branch. The dismiss branch needs a fetch — but only `.select('name')` so it's a minimal query.

### No new routes needed

The notification surfaces via the existing `GET /api/notifications` endpoint that drives the notification bell.

---

## Frontend

No changes required. The notification bell already renders arbitrary notification content as a string. The new `price_flag_resolved` type is handled by the catch-all display path.

Optionally, a small icon/color hint can be added to the notification list for this type in a follow-up — not in scope here.

---

## Discord DM

`price_flag_resolved` is added to the Discord DM notification prefs in feature #50. The DM prefix:

```
🏷️ Price Flag: Your price correction for Black Lotus was accepted and the price has been updated.
```

---

## Error Handling

- If the card lookup fails (deleted card), use `"Unknown Card"` — don't block the flag resolution
- Notification creation failure is non-fatal: log the error but still return the resolved flag to the admin

---

## Files Changed

| File | Change |
|------|--------|
| `backend/models/Notification.js` | Add `'price_flag_resolved'` to type enum |
| `backend/routes/admin.js` | Fire notification after flag resolve/dismiss |
