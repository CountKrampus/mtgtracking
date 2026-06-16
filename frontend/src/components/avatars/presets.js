// MTG-themed avatar presets - 17 total (7 mana symbols + 10 planeswalker silhouettes)

export const AVATAR_PRESETS = [
  {
    id: 'mana-white',
    name: 'White Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#f5e6d3" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#333">W</text>
      </svg>
    )
  },
  {
    id: 'mana-blue',
    name: 'Blue Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#a8ccf0" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#333">U</text>
      </svg>
    )
  },
  {
    id: 'mana-black',
    name: 'Black Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#2a2a2a" stroke="#666" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#ddd">B</text>
      </svg>
    )
  },
  {
    id: 'mana-red',
    name: 'Red Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#e85443" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#fff">R</text>
      </svg>
    )
  },
  {
    id: 'mana-green',
    name: 'Green Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#4a9d5f" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#fff">G</text>
      </svg>
    )
  },
  {
    id: 'mana-colorless',
    name: 'Colorless Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#b0b0b0" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="40" fontWeight="bold" textAnchor="middle" fill="#333">C</text>
      </svg>
    )
  },
  {
    id: 'mana-multi',
    name: 'Multi Mana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="multiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e85443"/>
            <stop offset="25%" stopColor="#f5e6d3"/>
            <stop offset="50%" stopColor="#4a9d5f"/>
            <stop offset="75%" stopColor="#a8ccf0"/>
            <stop offset="100%" stopColor="#2a2a2a"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#multiGrad)" stroke="#333" strokeWidth="2"/>
        <text x="50" y="60" fontSize="35" fontWeight="bold" textAnchor="middle" fill="#fff">∞</text>
      </svg>
    )
  },
  {
    id: 'planeswalker-jace',
    name: 'Jace',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#1a3a52" rx="10"/>
        <circle cx="50" cy="35" r="15" fill="#a8ccf0"/>
        <polygon points="50,55 35,75 65,75" fill="#a8ccf0"/>
        <circle cx="40" cy="32" r="3" fill="#1a3a52"/>
        <circle cx="60" cy="32" r="3" fill="#1a3a52"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-liliana',
    name: 'Liliana',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#3d2228" rx="10"/>
        <circle cx="50" cy="32" r="14" fill="#d4a5a5"/>
        <polygon points="50,50 35,70 65,70" fill="#2a2a2a"/>
        <rect x="38" y="58" width="24" height="15" fill="#8b4444" rx="2"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-teferi',
    name: 'Teferi',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#2a3f5f" rx="10"/>
        <circle cx="50" cy="33" r="14" fill="#e5c9a8"/>
        <path d="M35 55 Q50 65 65 55" fill="none" stroke="#a8ccf0" strokeWidth="3"/>
        <circle cx="42" cy="50" r="4" fill="#a8ccf0"/>
        <circle cx="58" cy="50" r="4" fill="#a8ccf0"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-garruk',
    name: 'Garruk',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#3d5a3d" rx="10"/>
        <circle cx="50" cy="32" r="14" fill="#c9a876"/>
        <polygon points="50,52 38,70 62,70" fill="#4a9d5f"/>
        <line x1="46" y1="48" x2="46" y2="65" stroke="#c9a876" strokeWidth="2"/>
        <line x1="54" y1="48" x2="54" y2="65" stroke="#c9a876" strokeWidth="2"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-gideon',
    name: 'Gideon',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#5a4a2a" rx="10"/>
        <circle cx="50" cy="32" r="14" fill="#f4d4a8"/>
        <polygon points="50,52 40,75 60,75" fill="#f5e6d3"/>
        <circle cx="46" cy="48" r="3" fill="#5a4a2a"/>
        <circle cx="54" cy="48" r="3" fill="#5a4a2a"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-nissa',
    name: 'Nissa',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#4a5a3d" rx="10"/>
        <circle cx="50" cy="32" r="14" fill="#d9a88a"/>
        <path d="M45 50 L50 65 L55 50" fill="#4a9d5f"/>
        <circle cx="42" cy="44" r="3" fill="#4a5a3d"/>
        <circle cx="58" cy="44" r="3" fill="#4a5a3d"/>
      </svg>
    )
  },
  {
    id: 'planeswalker-chandra',
    name: 'Chandra',
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100" height="100" fill="#5a3d2a" rx="10"/>
        <circle cx="50" cy="32" r="14" fill="#e8b48a"/>
        <polygon points="50,52 42,72 58,72" fill="#e85443"/>
        <circle cx="46" cy="46" r="3" fill="#5a3d2a"/>
        <circle cx="54" cy="46" r="3" fill="#5a3d2a"/>
      </svg>
    )
  }
];

export const getPresetById = (id) => AVATAR_PRESETS.find(p => p.id === id);
