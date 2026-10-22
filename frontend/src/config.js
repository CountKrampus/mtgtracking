// API configuration
// Production default: the public site is served by Caddy at mtgtracker.store,
// and its API proxy lives under https://mtgtracker.store/api.
// For local development, set REACT_APP_API_URL=http://localhost:5000/api in
// frontend/.env.local (do NOT commit .env.local). The localhost fallback is
// a safety net so a missing env var still points somewhere sensible in dev.
export const API_URL = process.env.REACT_APP_API_URL || 'https://mtgtracker.store/api';
// Set REACT_APP_SUPPORT_URL to the hosted donation page before building the frontend.
export const SUPPORT_URL = process.env.REACT_APP_SUPPORT_URL || 'https://buymeacoffee.com/creamkrampus';
