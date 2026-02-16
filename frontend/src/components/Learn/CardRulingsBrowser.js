import React, { useState } from 'react';
import { Search, BookOpen, Calendar } from 'lucide-react';

const CardRulingsBrowser = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rulings, setRulings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Call the backend API which fetches from Scryfall's rulings API
      const response = await fetch(`/api/scryfall/rulings?q=${encodeURIComponent(searchTerm)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rulings');
      }
      
      const data = await response.json();
      setRulings(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching rulings:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Card Rulings Browser</h1>
        <p className="text-gray-400">
          Look up official rulings for any Magic: The Gathering card
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter card name to search for rulings..."
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-200">Error: {error}</p>
        </div>
      )}

      {rulings.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">
            Rulings for "{searchTerm}"
          </h2>
          {rulings.map((ruling, index) => (
            <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Calendar size={16} />
                  <span>{new Date(ruling.published_at).toLocaleDateString()}</span>
                </div>
                {ruling.source && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                    {ruling.source.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-white leading-relaxed">{ruling.comment}</p>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-400">Fetching rulings...</span>
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No rulings yet</h3>
          <p className="text-gray-500">
            Search for a card name to view its official rulings
          </p>
        </div>
      )}
    </div>
  );
};

export default CardRulingsBrowser;