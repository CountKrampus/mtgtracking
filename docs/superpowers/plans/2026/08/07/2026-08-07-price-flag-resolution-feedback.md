# Price-Flag Resolution Feedback — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Notify the flag submitter when an admin resolves or dismisses their price correction flag.

**Spec:** `docs/superpowers/specs/2026-08-07-price-flag-resolution-feedback-design.md`

---

## Tasks

- [ ] **Task 1 — Add `price_flag_resolved` to Notification type enum**
  - File: `backend/models/Notification.js`
  - Add `'price_flag_resolved'` to the `type` enum array
  - `fromUserId` is not required for this type — update the `required` condition:
    ```js
    required: function() {
      return this.type !== 'price_alert'
          && this.type !== 'collection_health_report'
          && this.type !== 'price_flag_resolved';
    }
    ```

- [ ] **Task 2 — Fire notification in admin price-flag resolve/dismiss route**
  - File: `backend/routes/admin.js`
  - In `PUT /api/admin/price-flags/:id` (around line 2825):
    - The `resolve` branch already fetches `card` — reuse it
    - The `dismiss` branch needs a minimal card fetch: `Card.findById(flag.cardId).select('name')`
    - After `flag.save()` and ModerationHistory creation, fire the notification:
      ```js
      try {
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
      } catch (notifErr) {
        console.error('[price-flag] Failed to create resolution notification:', notifErr.message);
      }
      ```
    - Ensure `Notification` is imported at the top of `admin.js` (check if already imported)

- [ ] **Task 3 — Verify notification appears in the bell**
  - Confirm `GET /api/notifications` returns the new type without filtering it out
  - No frontend changes needed — the bell renders `content` as a string for all types

---

## Acceptance Criteria

- Submitting a price flag and having an admin resolve it → notification appears in the submitter's bell with "accepted" message
- Admin dismissing a flag → notification with "dismissed" message
- Card lookup failure (deleted card) → flag still resolves, notification fires with "Unknown Card", no 500 error
- Notification creation failure → flag still resolves, error is logged, no 500 error to admin
