---
name: commander-detection-fix
description: Procedure to add fallback logic and tests for MTGGoldfish commander detection during deck import
source: auto-skill
extracted_at: '2026-07-03T04:01:08.789Z'
---

## Goal
Ensure that when importing a deck from MTGGoldfish the commander (or partner commander) is correctly detected, even if the CSV does not include the explicit `isCommander` flag.

## Steps
1. **Review existing parser** (`backend/utils/deckHelpers.js`).
   - It extracts `commander` and `partnerCommander` from column 9 when the value is `'true'`.
2. **Add fallback detection**:
   - If no commander is found after the CSV pass, scan the `mainDeck` array for cards whose rarity is `'commander'` **or** whose set belongs to known commander sets.
   - Use a helper `isKnownCommanderCard(name)` that checks the card name against a small whitelist (e.g., contains "Commander" or matches a list of popular commander cards).
   - Assign the first match to `commander` and a second distinct match to `partnerCommander`.
3. **Update return object** to always include `commander` and `partnerCommander` (may be `null`).
4. **Add console warnings** when the fallback triggers, to aid future debugging.
5. **Write tests** (`backend/tests/mtggoldfish.test.js`):
   - Mock the HTTP response for a standard commander deck CSV and assert both `commander` and `partnerCommander` are returned correctly.
   - Mock a deck CSV where the `isCommander` column is missing/empty but the commander card has rarity `'commander'`; verify fallback detection works.
   - Mock a dual‑commander deck and ensure both commanders are captured.
   - Mock the edge‑case Limited Collector Booster format and assert the parser does not crash and returns `null` for commanders.
6. **Run the test suite** (`npm test` in the backend directory) and ensure all new tests pass.
7. **Update the import endpoint** (`backend/routes/decks.js`) to surface a warning in the response if no commander was detected after parsing, so the frontend can display a helpful message.

## Validation
- After the changes, importing a known MTGGoldfish commander deck (e.g., Nicol Bolas) shows the commander on the deck detail page.
- Dual‑commander decks display both commanders.
- No regression: existing non‑commander decks still import correctly.

## Future considerations
- Periodically refresh the commander‑set list from an external source.
- Add a configuration flag to enable/disable the fallback logic.
