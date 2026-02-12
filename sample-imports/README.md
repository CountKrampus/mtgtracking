# Sample Import Files

This directory contains sample files demonstrating the three supported import formats.

## Supported Formats

### 1. TXT Format (`sample-import.txt`)

**Use case:** Simple card lists, bulk imports from spreadsheets or text documents

**Format:**
```
4 Lightning Bolt
1 Black Lotus
2 Counterspell
```

**Features:**
- One card per line
- Optional quantity prefix: `4 Lightning Bolt` or just `Lightning Bolt` (defaults to 1)
- Set codes and collector numbers are automatically stripped:
  - `1 Evolving Wilds (PLST) C18-245` → imports as "Evolving Wilds"
- Case insensitive
- Empty lines are ignored

### 2. CSV Format (`sample-import.csv`)

**Use case:** Re-importing exported collections, spreadsheet data

**Format:**
```csv
Name,Set,Quantity,Condition,Price,Colors,Types,Mana Cost,Total Value
"Lightning Bolt","Limited Edition Alpha",4,"NM",100.00,"R","Instant","{R}",400.00
"Black Lotus","Limited Edition Alpha",1,"LP",25000.00,"","Artifact","{0}",25000.00
```

**Features:**
- Compatible with CSV exports from the app
- Header row is automatically detected and skipped
- Quoted fields are properly parsed
- Only card name and quantity are used during import (other data fetched from Scryfall)
- Perfect for backing up and restoring collections

### 3. JSON Format (`sample-import.json`)

**Use case:** Full data preservation, API integrations, programmatic imports

**Format:**
```json
[
  {
    "name": "Lightning Bolt",
    "set": "Limited Edition Alpha",
    "quantity": 4,
    "condition": "NM",
    "price": 100.00
  }
]
```

**Features:**
- Compatible with JSON exports from the app
- Supports both array of cards: `[{card1}, {card2}]`
- And single card object: `{card}`
- Only card name and quantity are used during import (other data fetched from Scryfall)
- Best for data interchange and backups

## How Import Works

When you import any of these files:

1. **Parsing:** File is parsed based on extension (.txt, .csv, or .json)
2. **Extraction:** Card names and quantities are extracted
3. **Lookup:** App searches Scryfall for each card
4. **Pricing:** Prices fetched from Exor Games (with Scryfall fallback)
5. **Import:** Cards added to your collection
6. **Merge:** Duplicate cards (same name, set, condition) have quantities merged

## Import Modes

### Online Mode (Default)
- Fetches full card data from Scryfall
- Gets pricing from Exor Games
- Caches card images locally
- Slower but complete data

### Offline Mode (Checkbox)
- Imports only name and quantity
- Sets defaults for other fields
- Much faster
- Use "Update All Prices" later when online to fetch complete data

## Testing the Samples

1. Start the MTG Tracker application
2. Click the "Import" button in the app
3. Select one of the sample files:
   - `sample-import.txt`
   - `sample-import.csv`
   - `sample-import.json`
4. Watch the import progress
5. Check the results in the import summary

All three files import the same cards - you can test each format to see how they work!

## Creating Your Own Import Files

### TXT File
```
4 Lightning Bolt
2 Counterspell
1 Jace, the Mind Sculptor
```

### CSV File
Export your current collection as CSV, then edit it in Excel/Google Sheets

### JSON File
Export your current collection as JSON, then edit in a text editor

## Notes

- **Set Codes:** Automatically stripped during import
- **Collector Numbers:** Automatically stripped during import
- **Duplicates:** Automatically merged if same name, set, and condition
- **Errors:** Failed imports are reported in the results summary
- **Performance:** Large imports (1000+ cards) work best in offline mode

## Tips

- Use TXT format for quick imports from decklists
- Use CSV format for bulk editing in spreadsheets
- Use JSON format for programmatic manipulation or backups
- Always check the import results summary for failed cards
- Use offline mode for large imports, then "Update All Prices" later
