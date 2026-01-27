# UI/UX Improvement Ideas

Legend: [x] means completed

## High Priority

### Navigation & Layout
- [x] **Sidebar Navigation**: Replace header button row with collapsible sidebar for cleaner navigation between views
- [x] **Tab-Based Navigation**: Persistent tabs (Collection | Decks | Wishlist | Life Counter) instead of toggle buttons
- [x] **Breadcrumb Navigation**: Show current location in the app (Home > Deck Builder > Deck Name)
- [x] **Dashboard / Home Page**: Landing page with collection summary, recent activity, quick actions, and stats
- [x] **Responsive Design Overhaul**: Full mobile-responsive layout — card table becomes card list on mobile
- [x] **Sticky Header**: Keep filters and action buttons visible when scrolling through large collections
- [x] **Keyboard Shortcuts**: Power-user shortcuts (N = new card, F = focus search, E = export, Ctrl+Z = undo)
- [x] **Command Palette**: Ctrl+K command palette for quick navigation and actions (like VS Code)

### Visual Design
- **Dark/Light Theme Toggle**: Currently dark-only; add light theme option for daytime use
- **Color Theme Picker**: Let users choose accent colors (purple, blue, green, red, etc.)
- **Custom Background**: Upload custom background image or choose from MTG art
- **Card Table Density Options**: Compact (current), Comfortable (more padding), and Detailed (shows more fields per row)
- **Column Customization**: Let users choose which columns appear in the card table and in what order
- **Consistent Modal Design**: Standardize all modals (wishlist, deck builder, settings) with same size, animation, and close behavior
- **Loading States**: Skeleton loaders for cards, spinners for API calls, progress bars for bulk operations

### Usability
- **Undo/Redo System**: Global undo for card edits, deletions, and bulk operations
- **Confirmation Dialogs**: Confirm before destructive actions (delete, bulk delete) with option to "Don't ask again"
- **Toast Notifications**: Replace alert() calls with non-blocking toast notifications (success, error, info)
- **Inline Editing**: Click any cell in the table to edit it directly (price, quantity, condition, location)
- **Drag-and-Drop File Import**: Drag .txt/.csv/.json files anywhere on the page to import
- **Empty State Illustrations**: Friendly illustrations and guidance when collection is empty, no search results, etc.
- **Onboarding Tour**: First-time user walkthrough highlighting key features with tooltips

## Medium Priority

### Data Display
- **Infinite Scroll Option**: Alternative to pagination — load more cards as you scroll down
- **Virtual Scrolling**: Render only visible rows for massive collections (10,000+ cards) without pagination
- **Card Preview Panel**: Side panel that shows full card details when you select a row (instead of hover-only)
- **Expandable Rows**: Click a table row to expand and see additional details (oracle text, price history, notes)
- **Column Sorting Indicators**: Clear arrows showing current sort direction; click column headers to sort
- **Sticky First Column**: Keep card name visible when scrolling horizontally on wide tables
- **Row Striping**: Alternating row colors for easier reading of large tables
- **Compact Number Formatting**: Show "$1.2k" instead of "$1,200.00" for large values in stats

### Accessibility
- **Screen Reader Support**: Proper ARIA labels on all interactive elements
- **Keyboard Navigation**: Full keyboard navigation through the card table and forms
- **High Contrast Mode**: Accessibility-friendly high contrast color scheme
- **Font Size Settings**: Adjustable font size for the entire app
- **Reduced Motion Mode**: Disable animations for users who prefer reduced motion
- **Color Blind Mode**: Alternative color indicators beyond red/green (use shapes or patterns)

### Micro-Interactions
- **Card Add Animation**: Smooth animation when a card is added to the collection
- **Delete Swipe**: Swipe-to-delete on mobile for quick card removal
- **Pull-to-Refresh**: Pull down on mobile to refresh card data
- **Hover Effects**: Subtle scale/glow effects on interactive elements
- **Transition Animations**: Smooth page/view transitions instead of instant swaps
- **Progress Celebrations**: Confetti or animations when hitting milestones (100 cards, complete set)

## Lower Priority

- **Customizable Dashboard Widgets**: Drag-and-drop widgets for stats, recent cards, price alerts, etc.
- **Multi-Language Support (i18n)**: Translate UI into French, Spanish, German, Japanese, etc.
- **Right-to-Left (RTL) Support**: Support for Arabic, Hebrew, and other RTL languages
- **Print-Friendly View**: CSS print stylesheet for printing collection lists cleanly
- **PWA Install Prompt**: Prompt users to install as PWA for app-like experience
- **Notification Center**: In-app notification center for price alerts, import completion, etc.
- **Contextual Help**: "?" icons next to features with explanatory tooltips
- **Changelog / What's New Modal**: Show recent updates when the app is updated
