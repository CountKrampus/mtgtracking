# Mobile & Accessibility Ideas

## High Priority

### Mobile Experience
- **Progressive Web App (PWA)**: Full PWA support with install prompt, offline caching, and home screen icon
- **Mobile-Optimized Card View**: Card list with swipeable cards instead of table rows on small screens
- **Touch-Friendly Controls**: Larger tap targets, swipe gestures, pull-to-refresh on mobile
- **Mobile Camera Integration**: Improved camera card scanning optimized for phone cameras
- **Responsive Filter Bar**: Collapsible filter panel on mobile (expand/collapse with tap)
- **Bottom Navigation Bar**: Fixed bottom nav on mobile for quick access to Collection, Decks, Wishlist, Life Counter
- **Mobile Life Counter**: Full-screen life counter optimized for phone use at the table
- **Offline-First Architecture**: Service worker caching so the entire app works without internet

### Native-Like Experience
- **App Shell Architecture**: Instant loading with app shell cached by service worker
- **Push Notifications**: Price drop alerts, game night reminders, trade requests as push notifications
- **Background Sync**: Queue card additions/edits offline and sync when connection is restored
- **Share Target**: Register as a share target so users can share card images/text to the app
- **Badging API**: Show unread notification count on the PWA icon

## Medium Priority

### Tablet Experience
- **Split-View Layout**: Collection list on left, card detail on right (iPad/tablet landscape)
- **Deck Builder Side-by-Side**: Collection browser + deck list side by side on wide screens
- **Multi-Window Support**: Open multiple views simultaneously on large screens

### Accessibility
- **WCAG 2.1 AA Compliance**: Full accessibility audit and compliance
- **Screen Reader Optimization**: Semantic HTML, ARIA labels, live regions for dynamic content
- **Keyboard-Only Navigation**: Complete app usability without a mouse
- **Focus Management**: Proper focus trapping in modals, focus restoration on close
- **Skip Links**: "Skip to main content" links for keyboard navigation
- **Alt Text for Card Images**: Meaningful alt text for all card images (card name + set)
- **Error Announcements**: Screen reader announcements for form errors and validation
- **Semantic Tables**: Proper table markup with headers, captions, and scope attributes

### Visual Accessibility
- **High Contrast Theme**: WCAG AAA contrast ratios for all text
- **Color Blind Friendly**: Don't rely solely on color to convey information; add icons/patterns
  - Mana colors: Add mana symbol icons alongside color indicators
  - Price changes: Use up/down arrows, not just green/red
  - Set completion: Add percentage text alongside colored progress bars
- **Dyslexia-Friendly Font**: Optional OpenDyslexic or similar font
- **Text Spacing Controls**: Adjustable line height, letter spacing, word spacing
- **Zoom Support**: Full functionality at 200% and 400% browser zoom without layout breaking

## Lower Priority

### Platform Integration
- **Native Mobile App (React Native)**: Port to React Native for true native iOS/Android experience
- **iOS Shortcuts**: Siri Shortcuts integration ("Hey Siri, how much is my MTG collection worth?")
- **Android Widgets**: Home screen widget showing collection value or recent additions
- **Apple Watch**: Quick life counter on watchOS
- **Wear OS**: Quick life counter on Wear OS
- **Smart Display**: Life counter for Google Nest Hub or Echo Show

### Performance on Mobile
- **Image Optimization**: Serve different image sizes based on device (small thumbnails on mobile, full on desktop)
- **Data Saver Mode**: Reduced data usage mode — text only, no images unless tapped
- **Battery Optimization**: Reduce animations and background processing on low battery
- **Low-End Device Support**: Performance optimizations for older phones (reduce JS bundle, simplify animations)

### Offline Improvements
- **Full Offline Deck Building**: Build decks offline using cached Scryfall data
- **Offline Autocomplete**: Local autocomplete database for card name entry without internet
- **Offline Price Estimates**: Cache last known prices for offline value estimates
- **Sync Conflict Resolution**: Smart merge when online/offline edits conflict
- **Offline Indicator**: Clear visual indicator showing online/offline status and queued changes
