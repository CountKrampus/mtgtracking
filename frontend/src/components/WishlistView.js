import React, { useMemo } from 'react';
import { RefreshCw, Heart, Plus, Star, Edit2, Trash2 } from 'lucide-react';
import { useWishlist } from '../contexts/WishlistContext';
import { useCardCollection } from '../contexts/CardCollectionContext';
import useSettings from '../hooks/useSettings';
import { API_URL } from '../config';

const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];

function MobileWishlistRow({ item, formatPrice, onAcquire, onEdit, onDelete }) {
  const isDeal = item.targetPrice > 0 && item.currentPrice > 0 && item.currentPrice <= item.targetPrice;
  const diff = item.currentPrice - item.targetPrice;
  return (
    <div className={`rounded-xl p-4 border transition ${isDeal ? 'bg-green-900/30 border-green-500/30' : 'bg-white/10 border-white/10'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{item.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.set && <span className="text-white/50 text-xs">{item.set}</span>}
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              item.priority === 'high' ? 'bg-red-600/50 text-white' :
              item.priority === 'medium' ? 'bg-yellow-600/50 text-white' :
              'bg-gray-600/50 text-white'
            }`}>
              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            </span>
            {isDeal && <span className="px-1.5 py-0.5 bg-green-600 text-white text-[11px] font-bold rounded">DEAL!</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white/80 text-sm">Target: {formatPrice(item.targetPrice)}</p>
          <p className="text-white/60 text-xs">Current: {formatPrice(item.currentPrice)}</p>
          {item.targetPrice > 0 && (
            <p className={`text-xs font-semibold ${diff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {diff <= 0 ? '' : '+'}{formatPrice(diff)}
            </p>
          )}
        </div>
      </div>
      {item.notes && <p className="text-white/40 text-xs mb-3 truncate">{item.notes}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => onAcquire(item._id)}
          className="p-2.5 bg-green-600/60 hover:bg-green-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Acquire">
          <Plus size={15} />
        </button>
        <button onClick={() => onEdit(item)}
          className="p-2.5 bg-blue-600/60 hover:bg-blue-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Edit">
          <Edit2 size={15} />
        </button>
        <button onClick={() => onDelete(item._id)}
          className="p-2.5 bg-red-600/60 hover:bg-red-600 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function WishlistView() {
  const {
    wishlistItems, wishlistFormData, setWishlistFormData,
    editingWishlistId, showWishlistAutocomplete, setShowWishlistAutocomplete,
    wishlistAutocompleteResults, wishlistFilterPriority, setWishlistFilterPriority,
    handleWishlistNameChange, selectWishlistAutocompleteCard,
    handleWishlistSubmit, handleWishlistEdit, handleWishlistDelete,
    handleWishlistCancel, handleAcquireWishlistItem, updateAllWishlistPrices,
  } = useWishlist();

  const { loading, hoveredCard, setHoveredCard } = useCardCollection();
  const { settings } = useSettings();

  const formatPrice = (priceUSD) => {
    if (priceUSD == null || isNaN(priceUSD)) priceUSD = 0;
    if (settings.displayCurrency === 'CAD') return `C$${(priceUSD / settings.cadToUsdRate).toFixed(2)}`;
    if (settings.displayCurrency === 'EUR') return `€${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
    return `$${priceUSD.toFixed(2)}`;
  };

  const filteredWishlistItems = useMemo(() => {
    return wishlistItems.filter(item => {
      if (wishlistFilterPriority !== 'all' && item.priority !== wishlistFilterPriority) return false;
      return true;
    });
  }, [wishlistItems, wishlistFilterPriority]);

  return (
    <div className="space-y-6">
      {/* Wishlist Controls */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
        <div className="flex gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <select
              value={wishlistFilterPriority}
              onChange={(e) => setWishlistFilterPriority(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <span className="text-white/60">
              {filteredWishlistItems.length} item{filteredWishlistItems.length !== 1 ? 's' : ''} in wishlist
            </span>
          </div>
          <button
            onClick={updateAllWishlistPrices}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition disabled:bg-gray-600"
          >
            <RefreshCw size={18} /> Update All Prices
          </button>
        </div>
      </div>

      {/* Add/Edit Wishlist Form */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">
          {editingWishlistId ? 'Edit Wishlist Item' : 'Add to Wishlist'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative lg:col-span-2">
            <input
              type="text"
              placeholder="Card Name (type to search)"
              value={wishlistFormData.name}
              onChange={(e) => handleWishlistNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowWishlistAutocomplete(false), 200)}
              className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            {showWishlistAutocomplete && wishlistAutocompleteResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-400 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {wishlistAutocompleteResults.map((cardName, index) => (
                  <div
                    key={index}
                    onClick={() => selectWishlistAutocompleteCard(cardName)}
                    className="px-4 py-2 hover:bg-purple-600 cursor-pointer text-white border-b border-white/10 last:border-b-0"
                  >
                    {cardName}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            placeholder="Target Price ($)"
            value={wishlistFormData.targetPrice || ''}
            onChange={(e) => setWishlistFormData({...wishlistFormData, targetPrice: parseFloat(e.target.value) || 0})}
            min="0"
            step="0.01"
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <select
            value={wishlistFormData.priority}
            onChange={(e) => setWishlistFormData({...wishlistFormData, priority: e.target.value})}
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <input
            type="number"
            placeholder="Quantity"
            value={wishlistFormData.quantity}
            onChange={(e) => setWishlistFormData({...wishlistFormData, quantity: parseInt(e.target.value) || 1})}
            min="1"
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <select
            value={wishlistFormData.condition}
            onChange={(e) => setWishlistFormData({...wishlistFormData, condition: e.target.value})}
            className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {conditions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={wishlistFormData.notes}
            onChange={(e) => setWishlistFormData({...wishlistFormData, notes: e.target.value})}
            className="lg:col-span-2 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {wishlistFormData.set && (
          <div className="text-white/60 text-sm mb-4">
            Set: {wishlistFormData.set} | Current Price: {formatPrice(wishlistFormData.currentPrice)}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleWishlistSubmit}
            className="flex-1 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
          >
            <Heart size={18} /> {editingWishlistId ? 'Update' : 'Add to Wishlist'}
          </button>
          {editingWishlistId && (
            <button
              onClick={handleWishlistCancel}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Mobile Wishlist List */}
      <div className="sm:hidden space-y-3">
        {filteredWishlistItems.length === 0 ? (
          <div className="text-center py-12 text-white/40">Your wishlist is empty. Add cards you want to acquire!</div>
        ) : (
          filteredWishlistItems.map(item => (
            <MobileWishlistRow
              key={item._id}
              item={item}
              formatPrice={formatPrice}
              onAcquire={handleAcquireWishlistItem}
              onEdit={handleWishlistEdit}
              onDelete={handleWishlistDelete}
            />
          ))
        )}
      </div>

      {/* Wishlist Table */}
      <div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/20">
              <tr>
                <th className="px-6 py-3 text-left text-white font-semibold">Card Name</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Set</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Qty</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Target Price</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Current Price</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Diff</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Priority</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Notes</th>
                <th className="px-6 py-3 text-left text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredWishlistItems.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-white/60">
                    Your wishlist is empty. Add cards you want to acquire!
                  </td>
                </tr>
              ) : (
                filteredWishlistItems.map(item => {
                  const isDeal = item.targetPrice > 0 && item.currentPrice > 0 && item.currentPrice <= item.targetPrice;
                  const diff = item.currentPrice - item.targetPrice;
                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-white/5 transition ${isDeal ? 'bg-green-900/30' : ''}`}
                      onMouseEnter={() => setHoveredCard(item)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <td className="px-6 py-4 text-white font-medium">
                        {item.name}
                        {isDeal && (
                          <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded font-bold">
                            DEAL!
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-white/80 text-sm">{item.set || '-'}</td>
                      <td className="px-6 py-4 text-white/80">{item.quantity}</td>
                      <td className="px-6 py-4 text-white/80">{formatPrice(item.targetPrice)}</td>
                      <td className="px-6 py-4 text-white/80">{formatPrice(item.currentPrice)}</td>
                      <td className={`px-6 py-4 font-semibold ${diff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.targetPrice > 0 ? (diff <= 0 ? '' : '+') + formatPrice(diff) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          item.priority === 'high' ? 'bg-red-600/50 text-white' :
                          item.priority === 'medium' ? 'bg-yellow-600/50 text-white' :
                          'bg-gray-600/50 text-white'
                        }`}>
                          <Star size={12} className="inline mr-1" />
                          {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/60 text-sm max-w-xs truncate">
                        {item.notes || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcquireWishlistItem(item._id)}
                            className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition"
                            title="Acquire - Move to Collection"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleWishlistEdit(item)}
                            className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleWishlistDelete(item._id)}
                            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wishlist Card Image Hover Preview */}
      {hoveredCard && hoveredCard.scryfallId && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <img
            src={`${API_URL}/images/${hoveredCard.scryfallId}`}
            alt={hoveredCard.name}
            className="w-80 rounded-xl shadow-2xl border-4 border-pink-500 bg-gray-900"
            onError={(e) => { e.target.src = hoveredCard.imageUrl || ''; }}
          />
        </div>
      )}
    </div>
  );
}

export default WishlistView;
