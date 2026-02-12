# Import Formats Guide

The MTG Tracker now supports importing card collections from **three different file formats**: `.txt`, `.csv`, and `.json`.

## Quick Start

1. Click the **Import** button in the app
2. Select a file with one of these extensions: `.txt`, `.csv`, or `.json`
3. The app automatically detects the format and parses accordingly
4. Watch the progress bar as cards are imported
5. Review the import summary

## Supported Formats

### 📝 TXT Format - Simple Text Lists

**Best for:** Quick imports, decklists from websites, manual entry

**Example:** `sample-imports/sample-import.txt`

```txt
4 Lightning Bolt
1 Black Lotus
2 Counterspell
1 Swords to Plowshares
3 Dark Ritual
```

**Features:**
- One card per line
- Optional quantity: `4 Lightning Bolt` or `Lightning Bolt` (defaults to 1)
- Set codes stripped automatically: `1 Evolving Wilds (PLST) C18-245`
- Simple and human-readable

**When to use:**
- Importing from text decklists
- Quick manual entry
- Copying card lists from forums or websites

---

### 📊 CSV Format - Spreadsheet Data

**Best for:** Re-importing exports, bulk editing in Excel/Google Sheets

**Example:** `sample-imports/sample-import.csv`

```csv
Name,Set,Quantity,Condition,Price,Colors,Types,Mana Cost,Total Value
"Lightning Bolt","Limited Edition Alpha",4,"NM",100.00,"R","Instant","{R}",400.00
"Black Lotus","Limited Edition Alpha",1,"LP",25000.00,"","Artifact","{0}",25000.00
```

**Features:**
- Compatible with CSV exports from this app
- Header row automatically detected and skipped
- Properly parses quoted fields
- Only Name and Quantity are used (other data fetched from Scryfall)

**When to use:**
- Re-importing a previously exported collection
- Bulk editing card lists in spreadsheet software
- Transferring data between different systems

---

### 🗂️ JSON Format - Structured Data

**Best for:** Backups, API integrations, programmatic imports

**Example:** `sample-imports/sample-import.json`

```json
[
  {
    "name": "Lightning Bolt",
    "set": "Limited Edition Alpha",
    "quantity": 4,
    "condition": "NM",
    "price": 100.00
  },
  {
    "name": "Black Lotus",
    "set": "Limited Edition Alpha",
    "quantity": 1,
    "condition": "LP",
    "price": 25000.00
  }
]
```

**Features:**
- Compatible with JSON exports from this app
- Supports both array `[{...}, {...}]` and single object `{...}`
- Only Name and Quantity are used (other data fetched from Scryfall)
- Machine-readable and structured

**When to use:**
- Creating backups with full fidelity
- Programmatic imports via scripts
- API integrations
- Data interchange with other applications

---

## Import Process

Regardless of format, all imports follow these steps:

1. **File Selection:** Choose your file (.txt, .csv, or .json)
2. **Format Detection:** App detects format by file extension
3. **Parsing:** File is parsed to extract card names and quantities
4. **Card Lookup:** Each card is searched on Scryfall
5. **Price Fetching:** Prices retrieved from Exor Games (with Scryfall fallback)
6. **Image Caching:** Card images downloaded and cached locally
7. **Import:** Cards added to your collection
8. **Duplicate Handling:** Cards with same name/set/condition have quantities merged

## Import Modes

### Online Mode (Default)
- ✅ Full card data from Scryfall
- ✅ Pricing from Exor Games
- ✅ Card images cached
- ⏱️ Slower (API calls for each card)
- 🌐 Requires internet connection

### Offline Mode
- ✅ Quick import (name and quantity only)
- ✅ Works without internet
- ✅ No API rate limits
- ⚠️ Minimal data (use "Update All Prices" later)
- ⚡ Much faster

**Toggle offline mode** with the checkbox next to the Import button.

## Sample Files

The `sample-imports/` directory contains example files for each format:

- `sample-import.txt` - Text format example
- `sample-import.csv` - CSV format example
- `sample-import.json` - JSON format example

**Try them out!** Import each file to see how the different formats work.

## Common Use Cases

### Scenario 1: Importing a Decklist from MTGGoldfish
1. Copy the decklist to a text file
2. Save as `decklist.txt`
3. Import using TXT format

### Scenario 2: Backing Up Your Collection
1. Export as JSON: Click "Download JSON"
2. Save the file somewhere safe
3. To restore: Import the JSON file

### Scenario 3: Editing Multiple Cards at Once
1. Export as CSV: Click "Download CSV"
2. Open in Excel/Google Sheets
3. Edit quantities, conditions, etc.
4. Save as CSV
5. Import the modified CSV (note: only name/quantity used, other data refreshed)

### Scenario 4: Migrating from Another App
1. Export from other app as CSV or JSON
2. Ensure it has "name" and "quantity" fields
3. Import into MTG Tracker

## Troubleshooting

**Import failed for some cards**
- Check the import summary for specific errors
- Verify card names are spelled correctly
- Some promo or special cards might not be found

**CSV import shows weird characters**
- Ensure CSV is UTF-8 encoded
- Try opening and re-saving in Excel/Notepad++

**JSON import fails**
- Validate your JSON syntax at jsonlint.com
- Ensure it's an array `[...]` or object `{...}`
- Check for missing commas or quotes

**Large imports are slow**
- Use Offline Mode for initial import
- Run "Update All Prices" later when online
- Imports with 1000+ cards work best offline

## Format Comparison

| Feature | TXT | CSV | JSON |
|---------|-----|-----|------|
| **Human Readable** | ✅ Excellent | ✅ Good | ⚠️ Moderate |
| **Spreadsheet Editing** | ❌ No | ✅ Yes | ❌ No |
| **Programmatic** | ⚠️ Moderate | ✅ Yes | ✅ Excellent |
| **Backup/Restore** | ⚠️ Name only | ✅ Good | ✅ Excellent |
| **Quick Entry** | ✅ Excellent | ❌ No | ❌ No |
| **Data Preservation** | ❌ Name/Qty only | ⚠️ Moderate | ✅ Complete |

## Tips

- **Start with TXT** for simple imports - it's the easiest
- **Use CSV** when you need to edit quantities in bulk
- **Use JSON** for complete backups and restores
- Always **check the import summary** for errors
- **Offline mode** is great for large imports (500+ cards)
- **Test with samples** first if you're unsure

## Technical Details

### TXT Parsing
- Splits by newline `\n`
- Filters empty lines
- Regex to extract quantity: `/^(\d+)\s+(.+)/`
- Strips set codes: `/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i`

### CSV Parsing
- Detects header row and skips it
- Regex for quoted fields: `/"([^"]+)","([^"]+)",(\d+)/`
- Extracts: Name, Set (ignored during import), Quantity

### JSON Parsing
- Uses `JSON.parse()`
- Handles both arrays and single objects
- Extracts `card.name` and `card.quantity`
- Falls back to `quantity: 1` if not specified

---

For more information, see the main [CLAUDE.md](./CLAUDE.md) documentation.
