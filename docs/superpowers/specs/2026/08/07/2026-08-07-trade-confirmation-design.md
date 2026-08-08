# Trade Shipped/Received Confirmation — Design

## Summary

Once a trade offer is accepted, both parties get a way to confirm they actually shipped their side and received the other side's cards — closing a real trust gap in the Trading Board, which today marks a listing `completed` the instant one party clicks Accept, with no tracking of whether cards physically changed hands.

## Current State (confirmed by reading the code)

- `PUT /api/trades/offers/:offerId/accept` (`backend/routes/trades.js:194-219`) sets `offer.status = 'accepted'`, marks the `TradeListing` as `'completed'`, and auto-cancels any other pending offers on that listing — all immediately, with no further confirmation step from either party.
- `TradeOffer` (`backend/models/TradeOffer.js`) has `fromUserId`/`fromUsername` (the person who made the offer) and `toUserId`/`toUsername` (the listing owner) — these define the two sides of the trade.
- `OfferCard` (`frontend/src/components/TradingBoard.js:278+`) already receives a `mode` prop (`'received'` when rendered in the listing-owner's "Offers Received" tab, `'sent'` when rendered in the offer-maker's "Offers Sent" tab) — this tells the component which side of the trade the current viewer is on, which is exactly what's needed to know which two of the four new confirmation fields the viewer is allowed to toggle.

## Data Model

Two trade "legs" exist once an offer is accepted: `fromUser` ships `offeredCards` to `toUser`; `toUser` ships the listing's card (`cardName`/`cardSet`/etc. already on the parent `TradeListing`) to `fromUser`. Four independent booleans on `TradeOffer`, all defaulting `false`:

- `fromUserShipped` — fromUser confirms they shipped their offered cards.
- `toUserReceived` — toUser confirms fromUser's shipment arrived.
- `toUserShipped` — toUser confirms they shipped the listing's card.
- `fromUserReceived` — fromUser confirms toUser's shipment arrived.

"Fully confirmed" is a derived value (`fromUserShipped && fromUserReceived && toUserShipped && toUserReceived`), not a separately stored field — avoids a redundant field that could drift out of sync with the four booleans it's derived from.

## Backend

One new route: `PUT /api/trades/offers/:offerId/shipping`, body `{ field: 'fromUserShipped' | 'fromUserReceived' | 'toUserShipped' | 'toUserReceived' }`.

- 404 if the offer doesn't exist.
- 400 if `offer.status !== 'accepted'` (shipping status only makes sense for a trade both parties agreed to — a pending/rejected/cancelled/countered offer has nothing to confirm).
- 403 if the requesting user doesn't own the field being toggled: `fromUserId` may only set `fromUserShipped`/`fromUserReceived`; `toUserId` may only set `toUserShipped`/`toUserReceived`. Enforced server-side (not just hidden in the UI) since this is a trust/integrity boundary, not just a display convenience.
- Sets the requested field to `true` (one-way — once shipped/received is confirmed, it can't be un-confirmed through this route; accidental clicks are a UI concern, not something the API needs to support reversing).
- If, after the update, all four fields are `true`, create one `Notification` of a new type (`trade_fully_confirmed`) for **both** `fromUserId` and `toUserId` — a single "closing the loop" notification rather than one per checkbox toggle.

## Frontend

`OfferCard` gains a "Shipping Status" section, rendered only when `offer.status === 'accepted'`:

- Shows all four fields as labeled checkboxes/badges (so each party can see the other side's progress, not just their own) — e.g. "You shipped your cards" / "They received your cards" / "They shipped their cards" / "You received their cards," phrased relative to the viewer.
- Only the two fields matching the viewer's role are interactive (`mode === 'sent'` → `fromUserShipped`/`fromUserReceived` clickable; `mode === 'received'` → `toUserShipped`/`toUserReceived` clickable); the other two render as read-only status indicators reflecting the other party's confirmations.
- Once all four are `true`, the section collapses to a single "✓ Trade fully confirmed" badge instead of four individual checkboxes — nothing left to confirm, no reason to keep showing interactive controls.

## Error Handling

- A toggle request failing (network error, or a 403 if state somehow desynced from what the UI thinks is allowed) shows an inline error on that offer card rather than a global alert, and does not optimistically flip the checkbox — wait for the server response before updating the UI, since a false-positive "shipped" confirmation is exactly the kind of trust-eroding bug this feature exists to prevent.

## Testing

Backend: standard Jest suite, following this codebase's existing `backend/__tests__/` conventions (e.g. `admin-badges-permissions.test.js`'s pattern for permission-boundary tests) — cover the 400 (wrong status), 403 (wrong user/field pairing), successful single-field update, and the all-four-true notification firing exactly once.

Frontend: no test infrastructure in this repo — verified via `npm run build` + manual click-through with two real trading-board accounts (or one account viewing both "sent" and "received" modes of the same accepted offer, if only one test account is available) — confirming the read-only vs. interactive field split renders correctly for each `mode`, and the "fully confirmed" collapse triggers correctly. Mobile-width (375px): confirm the four-field section wraps via `flex-wrap` rather than clipping, matching this session's established mobile-audit conventions.
