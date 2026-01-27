# Camera & Card Scanning Ideas

## High Priority

### Scanning Improvements
- **Rapid Scan Mode**: Continuously scan cards one after another without closing the camera between each scan
- **Batch Scan Counter**: Show running count of cards scanned in current session
- **Scan History**: Review all cards scanned in the current session before confirming import
- **Better OCR Accuracy**: Improve text recognition with card-specific training data or better preprocessing
- **Card Art Recognition**: Match by card art in addition to text for better accuracy on worn/foil cards
- **Multiple Card Detection**: Detect and identify multiple cards visible in a single photo
- **Scan Confirmation Step**: Show detected card with preview before adding — allow correction
- **Scryfall Art Matching**: Use Scryfall's image search to verify scanned cards against known art

### Camera UX
- **Camera Focus Assist**: Guide overlay showing optimal card placement area
- **Auto-Capture**: Automatically capture when a card is detected in frame (no button press needed)
- **Flash/Torch Toggle**: Toggle phone flashlight for scanning in dim environments
- **Image Quality Indicator**: Show real-time feedback on image quality (too blurry, too dark, etc.)
- **Crop & Rotate**: Auto-crop and rotate card images for better recognition
- **Scan Sound/Haptic**: Audio or vibration feedback when a card is successfully scanned

## Medium Priority

### Advanced Recognition
- **Foil Detection**: Detect if a card is foil from the scan (reflective surface analysis)
- **Condition Assessment**: Use image analysis to suggest card condition (NM, LP, MP, etc.)
- **Set Detection**: Identify which set/printing from the set symbol in the scan
- **Language Detection**: Detect card language and look up English name for foreign cards
- **Double-Faced Card Support**: Prompt to scan both faces of double-faced cards
- **Token Detection**: Recognize token cards and flag them appropriately

### Bulk Scanning
- **Pile Scanning**: Place a pile of cards face-up and scan from above — detect all visible cards
- **Video Scan Mode**: Record video while flipping through cards — extract and identify each card
- **Conveyor Mode**: Slide cards across the camera one at a time for rapid bulk entry
- **Collection Audit Mode**: Scan cards to verify they match your database (find missing or extra cards)

### Integration
- **Scan to Add**: Scan → identify → auto-add to collection in one smooth flow
- **Scan to Search**: Scan a card to look up its current price, rulings, and available printings
- **Scan to Deck**: Scan cards directly into a deck being built
- **Scan to Wishlist**: Scan a card at a store to add it to your wishlist with the store's price
- **Scan Opponent's Card**: Quick-scan an opponent's card to look up oracle text and rulings

## Lower Priority

- **Augmented Reality (AR) Overlay**: Hold phone over cards to see price, oracle text, and rulings overlaid
- **AR Collection Browse**: Point phone at binder pages to see stats overlaid on each card
- **3D Card Viewer**: Use phone camera to create 3D model of foil/textured cards
- **Card Art Wallpaper**: Scan a card to save its art as phone wallpaper
- **Share Scanned Image**: Share the scanned card image to social media with stats overlay
- **Scan Receipt Integration**: Scan store receipt and match purchased cards to add with purchase price
- **Machine Learning Improvement**: Let users correct misidentified cards to improve the ML model over time
- **Offline Scanning**: Full card recognition without internet using a local ML model
