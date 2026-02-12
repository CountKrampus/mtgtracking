import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

const viewLabels = {
  dashboard: 'Dashboard',
  collection: 'Collection',
  decks: 'Deck Builder',
  wishlist: 'Wishlist',
  lifecounter: 'Life Counter',
  settings: 'Settings',
};

const Breadcrumb = ({ currentView, setCurrentView }) => {
  const isHome = currentView === 'dashboard';

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 px-1">
      <button
        onClick={() => setCurrentView('dashboard')}
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
            {viewLabels[currentView] || currentView}
          </span>
        </>
      )}
    </nav>
  );
};

export default Breadcrumb;
