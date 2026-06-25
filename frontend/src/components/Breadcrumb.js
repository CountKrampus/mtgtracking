import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const pathLabels = {
  '/dashboard': 'Dashboard',
  '/collection': 'Collection',
  '/decks': 'Deck Builder',
  '/wishlist': 'Wishlist',
  '/forum': 'Forum',
  '/lifecounter': 'Life Counter',
  '/settings': 'Settings',
  '/messages': 'Messages',
  '/profile': 'My Profile',
  '/community-decks': 'Community Decks',
  '/learn/card-rulings': 'Card Rulings',
  '/learn/interaction-checker': 'Interaction Checker',
  '/learn/new-player-guide': 'New Player Guide',
  '/learn/keyword-glossary': 'Keyword Glossary',
  '/learn/combo-tutorials': 'Combo Tutorials',
  '/learn/format-guides': 'Format Guides',
  '/play/sealed-simulator': 'Sealed Simulator',
  '/play/archenemy': 'Archenemy Mode',
  '/play/star-variant': 'Star Variant',
  '/play/planechase': 'Planechase Mode',
  '/play/custom-format': 'Custom Format Builder',
  '/tools/cube-builder': 'Cube Builder',
  '/tools/reprint-tracker': 'Reprint Tracker',
  '/tools/set-calendar': 'Set Release Calendar',
  '/tools/spoilers': 'Spoiler Season',
};

const Breadcrumb = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const pathname = location.pathname;
  const isHome = pathname === '/dashboard' || pathname === '/';
  const label = pathLabels[pathname] || (
    pathname.startsWith('/forum') ? 'Forum' : pathname.replace(/^\//, '')
  );

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 px-1">
      <button
        onClick={() => navigate('/dashboard')}
        className={`flex items-center gap-1 transition ${
          isHome
            ? 'text-white/80'
            : 'text-white/50 hover:text-white'
        }`}
      >
        <Home size={14} />
        <span>Home</span>
      </button>
      {!isHome && (
        <>
          <ChevronRight size={14} className="text-white/30" />
          <span className="text-white/80 font-medium">
            {label}
          </span>
        </>
      )}
    </nav>
  );
};

export default Breadcrumb;
