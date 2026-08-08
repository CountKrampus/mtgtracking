# /trades create — Collection Browser Design

## Overview

`/trades create type:have <card>` currently requires typing a card name, resolved via the shared `resolveCard(interaction, api, searchName)` helper (case-insensitive substring match against the caller's collection, auto-picks on a single match, shows a plain select-menu of up to 25 matches otherwise). This works well when you already know the exact name, but browsing a large collection to decide what to list is awkward — you'd have to guess names.

This adds a second, optional path: an interactive, paginated, filterable browser that opens when `card` is left blank. Typing a name continues to work exactly as it does today (unchanged, fast path). The browser only applies to `type:have` — `type:want` listings are sourced from Scryfall (any card in existence, not the caller's collection), so a "browse my collection" UI doesn't apply there.

## Entry point

`card` becomes an optional argument on `/trades create` (currently required). If provided, behavior is unchanged (`resolveCard` flow). If omitted and `type:have`, the command opens the browser below instead of erring.

## Browser UI layout

One ephemeral message, 5 component rows (Discord's per-message cap), rebuilt and re-sent via `.update()` on every filter/page change:

- **Row 1 — Set select menu.** Options built from the unique `set` values across the caller's collection (deduplicated, alphabetical, capped at 25 per Discord's select-menu limit), with `All Sets` pinned as the first option. Placeholder shows the currently active set or "All Sets".
- **Row 2 — Type select menu.** Same construction, built from the unique entries in each card's `types` array, capped at 25, `All Types` pinned first.
- **Row 3 — Color toggle buttons.** Five buttons: W, U, B, R, G. Independent toggles (multi-select OR) — clicking one flips just that color's active/inactive state. Active buttons render `ButtonStyle.Success` (green); inactive render `ButtonStyle.Secondary` (gray).
- **Row 4 — Colorless, All Colors, Prev, Next** (4 buttons, fits the 5-per-row cap). Colorless toggles the same way the W/U/B/R/G buttons do (OR'd in). "All Colors" clears every active color toggle back to no color filter. Prev/Next page the filtered results; each is disabled (`setDisabled(true)`) when there's no previous/next page.
- **Row 5 — Card select menu.** The current page's matching cards (up to 25), each option labeled `${name} (${set}, ${condition})` with `value: card._id`, matching the label convention already used in `resolveCard.js`/`offer()`. Selecting one finalizes the pick.

## Filtering logic

Applied client-side over one `GET /cards` fetch (done once when the browser opens — no re-fetching per filter change):

1. Set filter: `card.set === selectedSet` (skipped entirely when `selectedSet` is `null`, i.e. "All Sets" is active).
2. Type filter: `card.types.includes(selectedType)` (skipped when `selectedType` is `null`).
3. Color filter: skipped entirely when no color toggle is active (0 active colors = show all colors, not zero cards). When one or more toggles are active, a card matches if `card.colors.some(c => activeColors.has(c))` OR (`activeColors.has('C')` AND `card.colors.length === 0`) — i.e. Colorless and the five WUBRG buttons all OR together.

All three filters AND together (set AND type AND color), matching the same AND-across-filter-categories convention the web app's own collection filters use.

## Pagination

Page size: 25 (matches the select-menu cap so a full page always fills one dropdown). Any filter change (set, type, or a color toggle) resets to page 1. Prev/Next only change the page, not the filters.

## Interaction loop & timeout

A loop around `interaction.channel.awaitMessageComponent(...)`, filtering to this interaction's message/user, handling whichever row's component fired (button click on Row 3/4, or a select change on Row 1/2/5) and re-rendering until Row 5 produces a final card selection. Each wait uses the same 30s timeout convention already used elsewhere in this bot (`resolveCard.js`, `offer()`'s multi-select) — timing out at any point cancels with a "Selection timed out" message, matching existing wording. The 30s window resets on every interaction (filter change or page turn), not just once at the start, so a user actively narrowing things down isn't cut off mid-browse.

## Empty state

If a filter combination matches zero cards, Row 5 renders as a single disabled option (`{label: 'No matching cards', value: 'none', disabled — via the row's own .setDisabled(true) rather than a per-option flag, since StringSelectMenuBuilder requires at least one option}`) so the message stays structurally valid without being selectable. Prev/Next reflect the (zero-length) page count as usual.

## Non-goals

- No condition, tag, foil/token, or quantity filters — set/color/type only, per the earlier confirmed scope.
- The browser does not apply to `type:want` (Scryfall-sourced, not the caller's collection) — that path is untouched.
- No change to the existing typed-name fast path — `resolveCard.js` and its behavior are unmodified.
- No persistence of filter state across separate `/trades create` invocations — each browser session starts at "All Sets / All Types / no colors / page 1".
