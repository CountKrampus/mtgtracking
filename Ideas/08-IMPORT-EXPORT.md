# Import & Export Ideas

## High Priority

### Import Formats
- **Moxfield Import**: Import entire collection from Moxfield CSV/API export
- **Archidekt Import**: Import collection from Archidekt export
- **TCGPlayer Import**: Import from TCGPlayer collection CSV export
- **Deckbox Import**: Import from Deckbox.org CSV export format
- **MTG Arena Import**: Parse Arena collection export format
- **MTGO Import**: Parse Magic Online collection/deck format
- **Delver Lens Import**: Import from Delver Lens (popular mobile scanner app) export
- **CardKingdom Import**: Import from CardKingdom order history
- **Excel/XLSX Import**: Support Excel spreadsheet format in addition to CSV
- **Drag-and-Drop Import**: Drag files onto the browser window to start import (any supported format)
- **Smart Format Detection**: Auto-detect import format from file contents (don't require user to specify)

### Import Improvements
- **Import Preview**: Show preview of cards to be imported before confirming (with edit ability)
- **Import Mapping**: Map CSV columns to card fields when columns don't match expected format
- **Import Conflict Resolution**: When importing duplicates, let user choose: merge, skip, or create new
- **Import Undo**: Ability to undo an entire import (remove all cards added in that batch)
- **Incremental Import**: Track which cards were imported in each batch; tag with import date
- **Set Code Matching**: When import includes set codes, use them to get the exact printing
- **Collector Number Matching**: Match by collector number for exact card version (foil, art variant)

### Export Formats
- **Moxfield Export**: Export in Moxfield-compatible format for easy migration
- **Archidekt Export**: Export compatible with Archidekt import
- **TCGPlayer Mass Entry**: Export formatted for TCGPlayer mass entry (selling/buying)
- **Deckbox Export**: Export compatible with Deckbox.org
- **PDF Export**: Beautiful formatted PDF of collection with images, stats, and values
- **Excel/XLSX Export**: Native Excel format with formatting, formulas, and sheets
- **Google Sheets Export**: Direct export to a new Google Sheet (via API)
- **HTML Export**: Standalone HTML page with your collection that can be opened in any browser

## Medium Priority

### Sync & Integration
- **Cloud Sync Between Devices**: Sync collection across multiple computers/devices
- **Google Drive Backup**: Auto-backup collection to Google Drive as JSON
- **Dropbox Backup**: Auto-backup to Dropbox
- **Scheduled Auto-Export**: Automatically export collection daily/weekly to a specified location
- **Git-Based Version Control**: Store collection as JSON in a Git repo for version history
- **API Access Token**: Personal API token for building custom integrations

### Advanced Import
- **Photo Import**: Take a photo of a pile of cards; use OCR/AI to identify and import all cards
- **Batch Camera Scanning**: Rapidly scan cards one-by-one with the camera for fast entry
- **Receipt Scanning**: Scan store receipts to import purchased cards with prices
- **Sealed Product Import**: Enter a sealed product (booster box, bundle) and add all possible cards from that set
- **Deck List Screenshot Import**: Paste a screenshot of a deck list; use OCR to extract card names
- **URL Import**: Paste a URL to a Moxfield/Archidekt/TappedOut deck and import directly

### Export Improvements
- **Selective Export**: Export only filtered/selected cards instead of entire collection
- **Export Templates**: Save custom export configurations (which fields, format, sorting)
- **Export History**: Track when exports were made with download links to past exports
- **Split Export**: Export large collections in multiple files (split by set, color, or max rows)

## Lower Priority

- **Scryfall Deck Format Export**: Export decks in Scryfall's deck format
- **MTG Goldfish Import/Export**: Compatible with MTG Goldfish portfolio
- **CardsRealm Integration**: Import/export with CardsRealm
- **TopDecked Import**: Import from TopDecked app
- **EDHRec Export**: Export deck in EDHRec-compatible format
- **Plain Text Summary Export**: Human-readable text summary of collection for sharing in Discord/forums
- **QR Code Collection Share**: Generate QR code that encodes collection data (or links to export)
- **NFC Tag Write**: Write collection summary to NFC tags for binder identification
