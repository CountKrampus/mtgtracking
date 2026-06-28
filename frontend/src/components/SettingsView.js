import React from 'react';
import axios from 'axios';
import { Settings, Plus, Trash2, Edit2, MapPin, QrCode, Printer, Layers, Heart, Crown, BarChart3, Zap, X } from 'lucide-react';
import { API_URL } from '../config';
import DeckFoldersTab from './DeckFoldersTab';

export default function SettingsView({
  settings, updateSettings, resetSettings, formatPrice,
  locations, availableTags, locationStats,
  newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
  editingLocation, handleCreateLocation, handleUpdateLocation, cancelEditLocation,
  startEditLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
  newTagName, setNewTagName, handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  generateQR, qrDataUrls, setQrDataUrls, setQRPreviewLocation, setShowQRPreview, setShowPrintLabels
}) {
    const [settingsTab, setSettingsTab] = React.useState('display');
    const [clearCollectionConfirm, setClearCollectionConfirm] = React.useState(false);
    const [clearCacheConfirm, setClearCacheConfirm] = React.useState(false);
    const [statsData, setStatsData] = React.useState(null);

    // Fetch stats on mount
    React.useEffect(() => {
      const fetchStats = async () => {
        try {
          const res = await axios.get(`${API_URL}/stats`);
          setStatsData(res.data);
        } catch (err) {
          console.error('Failed to fetch stats:', err);
        }
      };
      fetchStats();
    }, []);

    const handleClearCollection = async () => {
      if (!clearCollectionConfirm) {
        setClearCollectionConfirm(true);
        return;
      }
      try {
        await axios.delete(`${API_URL}/collection/clear-all`, { data: { confirmation: 'DELETE_ALL_CARDS' } });
        setClearCollectionConfirm(false);
        window.location.reload();
      } catch (err) {
        alert('Failed to clear collection: ' + err.message);
      }
    };

    const handleClearCache = async () => {
      if (!clearCacheConfirm) {
        setClearCacheConfirm(true);
        return;
      }
      try {
        const res = await axios.delete(`${API_URL}/cache/clear`);
        setClearCacheConfirm(false);
        alert(`Cleared ${res.data.deletedCount} cached images`);
        // Refresh stats
        const statsRes = await axios.get(`${API_URL}/stats`);
        setStatsData(statsRes.data);
      } catch (err) {
        alert('Failed to clear cache: ' + err.message);
      }
    };

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} /> Settings
        </h1>

        {/* Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/20 pb-0 scrollbar-hide sm:flex-wrap">
          {[
            { id: 'display', label: 'Display' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'features', label: 'Features' },
            { id: 'data', label: 'Data' },
            { id: 'locations', label: 'Locations' },
            { id: 'tags', label: 'Tags' },
            { id: 'folders', label: 'Deck Folders' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-lg font-medium transition ${
                settingsTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Display Settings */}
        {settingsTab === 'display' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Display Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-white/80 text-sm mb-2">Items per page</label>
                <select
                  value={settings.pageSize}
                  onChange={(e) => updateSettings({ pageSize: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Default sort</label>
                <select
                  value={settings.defaultSort}
                  onChange={(e) => updateSettings({ defaultSort: e.target.value })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="quantity">Quantity</option>
                  <option value="totalValue">Total Value</option>
                  <option value="type">Type</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Default condition</label>
                <select
                  value={settings.defaultCondition}
                  onChange={(e) => updateSettings({ defaultCondition: e.target.value })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Moderately Played (MP)</option>
                  <option value="HP">Heavily Played (HP)</option>
                  <option value="DMG">Damaged (DMG)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Settings */}
        {settingsTab === 'pricing' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Pricing Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-white/80 text-sm mb-2">Display Currency</label>
                <div className="flex gap-2">
                  {['USD', 'CAD', 'EUR'].map(currency => (
                    <button
                      key={currency}
                      onClick={() => updateSettings({ displayCurrency: currency })}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        settings.displayCurrency === currency
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">CAD to USD rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.cadToUsdRate}
                    onChange={(e) => updateSettings({ cadToUsdRate: parseFloat(e.target.value) || 0.73 })}
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">USD to EUR rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.usdToEurRate}
                    onChange={(e) => updateSettings({ usdToEurRate: parseFloat(e.target.value) || 0.92 })}
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Condition Price Multipliers</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['NM', 'LP', 'MP', 'HP', 'DMG'].map(cond => (
                    <div key={cond}>
                      <label className="block text-white/60 text-xs mb-1">{cond}</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={settings.conditionMultipliers[cond]}
                        onChange={(e) => updateSettings({
                          conditionMultipliers: { [cond]: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Toggles */}
        {settingsTab === 'features' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Feature Toggles</h2>
            <p className="text-white/60 text-sm mb-4">Enable or disable features to customize your experience.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: 'deckBuilder', label: 'Deck Builder', icon: Layers },
                { id: 'wishlist', label: 'Wishlist', icon: Heart },
                { id: 'commanderRecs', label: 'Commander Recommendations', icon: Crown },
                { id: 'setCompletion', label: 'Set Completion Tracker', icon: BarChart3 },
                { id: 'comboFinder', label: 'Combo Finder', icon: Zap },
              ].map(feature => {
                const Icon = feature.icon;
                const enabled = settings.features[feature.id] !== false;
                return (
                  <button
                    key={feature.id}
                    onClick={() => updateSettings({ features: { [feature.id]: !enabled } })}
                    className={`flex items-center gap-3 p-4 rounded-lg transition ${
                      enabled
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{feature.label}</span>
                    {enabled && <span className="ml-auto">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Management */}
        {settingsTab === 'data' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Data Management</h2>
            {statsData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Total Cards</div>
                  <div className="text-2xl font-bold text-white">{statsData.totalCards?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Unique Cards</div>
                  <div className="text-2xl font-bold text-white">{statsData.uniqueCards?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Collection Value</div>
                  <div className="text-2xl font-bold text-white">{formatPrice(statsData.totalValue || 0)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Cached Images</div>
                  <div className="text-2xl font-bold text-white">{statsData.cachedImageCount?.toLocaleString() || 0}</div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleClearCollection}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clearCollectionConfirm
                    ? 'bg-red-700 text-white animate-pulse'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {clearCollectionConfirm ? 'Click again to confirm' : 'Clear Collection'}
              </button>
              <button
                onClick={handleClearCache}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clearCacheConfirm
                    ? 'bg-orange-700 text-white animate-pulse'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {clearCacheConfirm ? 'Click again to confirm' : 'Clear Image Cache'}
              </button>
              <button
                onClick={() => {
                  resetSettings();
                  alert('Settings reset to defaults');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
              >
                Reset All Settings
              </button>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {settingsTab === 'locations' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Storage Locations</h2>
            {/* Add/Edit Location Form */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-white mb-3">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Location name (e.g., Binder A, Box 1)"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="text"
                  value={newLocationDesc}
                  onChange={(e) => setNewLocationDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex gap-2">
                  {editingLocation ? (
                    <>
                      <button
                        onClick={handleUpdateLocation}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                      >
                        Update Location
                      </button>
                      <button
                        onClick={cancelEditLocation}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCreateLocation}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                    >
                      <Plus size={18} className="inline mr-2" /> Add Location
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Existing Locations */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-semibold text-white">Existing Locations ({locations.length})</h3>
              {locations.length > 0 && (
                <button
                  onClick={async () => {
                    const urls = {};
                    for (const loc of locations) {
                      urls[loc.name] = await generateQR(loc.name);
                    }
                    setQrDataUrls(urls);
                    setShowPrintLabels(true);
                  }}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1 transition"
                >
                  <Printer size={16} /> Print All Labels
                </button>
              )}
            </div>
            {locations.length === 0 ? (
              <p className="text-white/60">No locations created yet.</p>
            ) : (
              <div className="space-y-2">
                {locations.map(location => (
                  <div key={location._id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        <MapPin size={16} /> {location.name}
                        {locationStats[location.name] && (
                          <span className="text-white/50 text-sm ml-2">
                            ({locationStats[location.name].cardCount} cards, {formatPrice(locationStats[location.name].totalValue)})
                          </span>
                        )}
                      </div>
                      {location.description && (
                        <div className="text-white/60 text-sm mt-1">{location.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleLocationIgnorePrice(location._id, location.ignorePrice)}
                        className={`px-2 py-2 rounded text-xs font-medium transition ${
                          location.ignorePrice
                            ? 'bg-orange-600 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                        title={location.ignorePrice ? 'Price is ignored in stats' : 'Click to ignore price in stats'}
                      >
                        {location.ignorePrice ? '$ off' : '$'}
                      </button>
                      <button
                        onClick={async () => {
                          const dataUrl = await generateQR(location.name);
                          setQrDataUrls(prev => ({ ...prev, [location.name]: dataUrl }));
                          setQRPreviewLocation(location);
                          setShowQRPreview(true);
                        }}
                        className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition"
                        title="Generate QR Label"
                      >
                        <QrCode size={16} />
                      </button>
                      <button
                        onClick={() => startEditLocation(location)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location._id)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags Tab */}
        {settingsTab === 'tags' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
            {/* Add Tag Form */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-white mb-3">Add New Tag</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  placeholder="Tag name (e.g., commander, trade)"
                  className="flex-1 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handleCreateTag}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                >
                  <Plus size={18} className="inline mr-1" /> Add
                </button>
              </div>
            </div>

            {/* Existing Tags */}
            <h3 className="text-md font-semibold text-white mb-3">Existing Tags ({availableTags.length})</h3>
            {availableTags.length === 0 ? (
              <p className="text-white/60">No tags created yet. Tags are created when you add them to cards or create them here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const tagName = tag.name || tag;
                  const ignorePrice = tag.ignorePrice || false;
                  return (
                    <div key={tagName} className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2 group">
                      <span className="text-white">{tagName}</span>
                      <button
                        onClick={() => handleToggleTagIgnorePrice(tagName, ignorePrice)}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium transition ${
                          ignorePrice
                            ? 'bg-orange-600 text-white'
                            : 'bg-white/10 text-white/40 hover:bg-white/20'
                        }`}
                        title={ignorePrice ? 'Price is ignored in stats' : 'Click to ignore price in stats'}
                      >
                        {ignorePrice ? '$ off' : '$'}
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tagName)}
                        className="text-white/40 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                        title="Delete tag"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Deck Folders Tab */}
        {settingsTab === 'folders' && (
          <DeckFoldersTab />
        )}
      </div>
    );
}
