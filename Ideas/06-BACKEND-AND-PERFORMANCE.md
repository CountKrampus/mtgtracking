# Backend & Performance Ideas

## High Priority

### Performance Optimization
- **Server-Side Pagination**: Move pagination to the backend — send only 20-50 cards per request instead of loading all cards at once
- **Server-Side Filtering & Sorting**: Move filtering/sorting to MongoDB queries to handle 10,000+ card collections
- ~~**Database Indexing**: Add MongoDB indexes on frequently queried fields (name, set, setCode, colors, types, rarity, tags, location)~~ **DONE** - Single-field + compound indexes added
- ~~**API Response Caching**: Cache Scryfall API responses in MongoDB/Redis with TTL to reduce external API calls~~ **DONE** - ApiCache schema with 24hr TTL, applied to autocomplete + search
- ~~**Image Lazy Loading**: Only load card images when they scroll into view (intersection observer)~~ **DONE** - `loading="lazy"` on modal images (similar cards, synergies, commanders, set completion, print proxies)
- ~~**Bundle Optimization**: Code-split the frontend — lazy load Deck Builder, Life Counter, and other views~~ **DONE** - React.lazy() + Suspense for DeckBuilder, CameraModal, LifeCounter, Dashboard
- ~~**Gzip/Brotli Compression**: Enable response compression on Express for faster API responses~~ **DONE** - compression middleware added
- ~~**Rate Limiting**: Add rate limiting to prevent accidental API abuse~~ **DONE** - 200 req/min general, 30 req/min Scryfall proxy

### Data Integrity
- **Database Backups**: Scheduled automatic backups of MongoDB data (daily/weekly)
- **Backup Export**: One-click full database export for manual backups
- **Backup Import / Restore**: Restore collection from a backup file
- **Data Validation**: Stricter server-side validation on all card fields (price > 0, quantity > 0, valid condition)
- **Orphan Cleanup**: Periodic cleanup of orphaned data (images without cards, tags without cards)
- **Transaction Support**: Use MongoDB transactions for bulk operations to prevent partial failures

### API Improvements
- **API Versioning**: Version the API (/api/v1/cards) for backwards compatibility
- **GraphQL API**: Optional GraphQL endpoint for flexible data querying (fetch only needed fields)
- **WebSocket Support**: Real-time updates via WebSocket for price changes, import progress, and multi-device sync
- **Pagination Metadata**: Return total count, page count, current page, and links in paginated responses
- **Error Standardization**: Consistent error response format with error codes, messages, and suggestions
- **Request Logging**: Log all API requests with timing for performance monitoring

## Medium Priority

### Architecture
- **Modular Backend**: Split server.js into route files, controllers, services, and middleware
- **TypeScript Migration**: Migrate backend and frontend to TypeScript for type safety
- **Environment Validation**: Validate all environment variables on startup (fail fast if MONGODB_URI is missing)
- **Health Check Endpoint**: GET /api/health returning server status, DB connection, uptime, memory usage
- **Graceful Shutdown**: Handle SIGTERM/SIGINT properly — close DB connections, finish in-flight requests
- **Docker Support**: Dockerfile and docker-compose.yml for easy deployment and development setup
- **CI/CD Pipeline**: GitHub Actions for automated testing, linting, and deployment

### Caching & Storage
- **Redis Cache Layer**: Cache frequently accessed data (cards list, stats, autocomplete) in Redis
- **Image CDN**: Serve cached images from a CDN for faster loading (or use Cloudflare)
- **Scryfall Bulk Data**: Download Scryfall bulk data dump instead of individual API calls for large operations
- **Local Scryfall Database**: Import entire Scryfall database locally for instant offline autocomplete and search
- **Progressive Image Loading**: Load low-res thumbnails first, then full images (blur-up effect)
- **Service Worker**: Cache static assets and API responses for true offline-first experience

### Monitoring
- **Error Tracking**: Integrate Sentry or similar for automatic error reporting
- **Performance Monitoring**: Track API response times and identify slow endpoints
- **Database Monitoring**: Track query performance, collection sizes, and index usage
- **Uptime Monitoring**: Alert when the server goes down
- **Usage Analytics**: Track which features are used most (anonymous, privacy-respecting)

## Lower Priority

- **Multi-User / Authentication**: User accounts with login (email/password or OAuth)
- **Role-Based Access**: Admin vs regular user permissions
- **Multi-Collection Support**: Support multiple separate collections per user (one per household member)
- **Cloud Sync**: Sync local MongoDB with cloud automatically (bidirectional)
- **API Documentation**: Swagger/OpenAPI documentation for all endpoints
- **Webhook Support**: Send webhooks on card added, price changed, etc. for custom integrations
- **Electron Desktop App**: Package as standalone desktop app with Electron
- **Batch Queue System**: Queue long-running operations (bulk import, price update) with job status tracking
- **Database Migration System**: Version-controlled schema migrations for safe updates
