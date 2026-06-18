# Column Visibility System

## Overview
Users can right-click on the card table header to access a context menu that shows all available columns. Users can toggle which columns are visible. Preferences are saved per user in the database.

## Default Visible Columns
- Card Name
- Qty
- Condition
- Price

## All Available Columns (toggleable)
- Set
- Set Code
- Collector #
- Rarity
- Mana Cost
- Colors
- Types
- Location
- Foil
- Token
- Tags
- Buylist Value
- Sell Value
- Total
- Actions

## How to Use
1. Right-click on any table header
2. Context menu appears at cursor
3. Click checkboxes to toggle column visibility
4. Changes are saved automatically

## API Endpoints
- GET /api/user/column-preferences — fetch user's visible columns
- PUT /api/user/column-preferences — save visible columns

## Adding New Columns
1. Add column definition to ALL_COLUMNS in useColumnVisibility.js
2. Add conditional rendering in table body: {isColumnVisible('columnId') && <td>...</td>}
3. Column automatically appears in context menu
