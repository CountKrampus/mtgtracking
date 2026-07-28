import React, { useState } from 'react';
import { ArrowLeftRight, Plus, X, Check, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrades } from '../contexts/TradesContext';
import { useAuthContext } from '../contexts/AuthContext';
import { API_URL } from '../config';
import CollectionComparison from './CollectionComparison';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const CONDITION_COLORS = {
  NM: 'text-green-400', LP: 'text-blue-400',
  MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400',
};

function ListingCard({ listing, onOffer, onCompare, isOwn }) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 p-4 flex gap-3">
      {listing.imageUrl && (
        <img src={listing.imageUrl} alt={listing.cardName}
          className="w-14 h-20 object-cover rounded-lg flex-shrink-0 shadow-lg" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{listing.cardName}</p>
            {listing.cardSet && <p className="text-white/50 text-xs">{listing.cardSet}</p>}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
            listing.type === 'have' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {listing.type === 'have' ? 'HAVE' : 'WANT'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-xs font-semibold ${CONDITION_COLORS[listing.condition] || 'text-white/60'}`}>
            {listing.condition}
          </span>
          {listing.quantity > 1 && <span className="text-white/50 text-xs">×{listing.quantity}</span>}
          {listing.estimatedValue > 0 && <span className="text-white/60 text-xs">${listing.estimatedValue.toFixed(2)}</span>}
        </div>
        {listing.notes && <p className="text-white/40 text-xs mt-1 truncate">{listing.notes}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/40 text-xs">by {listing.username}</span>
          {!isOwn && onOffer && listing.status === 'active' && (
            <button onClick={() => onOffer(listing)}
              className="px-3 py-1 bg-purple-600/60 hover:bg-purple-600 text-white text-xs rounded-lg transition">
              Make Offer
            </button>
          )}
        </div>
        {!isOwn && onCompare && (
          <button
            data-testid="compare-link"
            onClick={() => onCompare(listing.username)}
            className="text-blue-400 hover:text-blue-300 text-xs underline mt-1 w-full text-center transition-colors"
          >
            Compare collections
          </button>
        )}
      </div>
    </div>
  );
}

function CreateListingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    type: 'have', cardName: '', cardSet: '', condition: 'NM',
    quantity: 1, estimatedValue: '', notes: '',
    scryfallId: '', imageUrl: '',
  });
  const [autocomplete, setAutocomplete] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = async (val) => {
    setForm(f => ({ ...f, cardName: val }));
    if (val.length >= 2) {
      try {
        const res = await fetch(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(val)}`);
        setAutocomplete(await res.json());
      } catch { setAutocomplete([]); }
    } else {
      setAutocomplete([]);
    }
  };

  const selectCard = async (name) => {
    try {
      const res = await fetch(`${API_URL}/scryfall/search?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setForm(f => ({
        ...f,
        cardName: data.name,
        cardSet: data.set || '',
        scryfallId: data.scryfallId || '',
        imageUrl: data.imageUrl || '',
        estimatedValue: data.prices?.usd || '',
      }));
    } catch {}
    setAutocomplete([]);
  };

  const handleSubmit = async () => {
    if (!form.cardName) return;
    setSubmitting(true);
    try {
      await onCreate({ ...form, estimatedValue: parseFloat(form.estimatedValue) || 0 });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-gray-900 border border-white/20 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-semibold">Post a Listing</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            {['have', 'want'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  form.type === t
                    ? (t === 'have' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}>
                {t === 'have' ? 'I Have (for trade)' : 'I Want (looking for)'}
              </button>
            ))}
          </div>

          <div className="relative">
            <input value={form.cardName} onChange={e => handleNameChange(e.target.value)}
              placeholder="Card name..."
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              style={{ fontSize: '16px' }} />
            {autocomplete.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-gray-800 border border-white/20 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-2xl">
                {autocomplete.slice(0, 8).map(name => (
                  <button key={name} onClick={() => selectCard(name)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition">
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs mb-1 block">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">Quantity</label>
              <input type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1 block">Estimated Value (USD)</label>
            <input type="number" step="0.01" placeholder="0.00" value={form.estimatedValue}
              onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none" />
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1 block">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Condition details, preferred trades, etc." rows={2}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none resize-none"
              style={{ fontSize: '16px' }} />
          </div>

          <button onClick={handleSubmit} disabled={submitting || !form.cardName}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition">
            {submitting ? 'Posting...' : 'Post Listing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MakeOfferModal({ listing, onClose, onSubmit }) {
  const [cards, setCards] = useState([{ cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateCard = (i, field, val) => setCards(c => c.map((card, idx) => idx === i ? { ...card, [field]: val } : card));

  const handleSubmit = async () => {
    const valid = cards.filter(c => c.cardName.trim());
    if (valid.length === 0) { alert('Add at least one card to offer'); return; }
    setSubmitting(true);
    try {
      await onSubmit(
        listing._id,
        valid.map(c => ({ ...c, estimatedValue: parseFloat(c.estimatedValue) || 0 })),
        message
      );
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-gray-900 border border-white/20 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-900 border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-white font-semibold">Make an Offer</h3>
            <p className="text-white/50 text-xs">for: {listing.cardName}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-white/60 text-sm font-medium">Cards you're offering:</p>
          {cards.map((card, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input value={card.cardName} onChange={e => updateCard(i, 'cardName', e.target.value)}
                  placeholder="Card name"
                  className="flex-1 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none"
                  style={{ fontSize: '16px' }} />
                {cards.length > 1 && (
                  <button onClick={() => setCards(c => c.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-300 flex-shrink-0"><X size={14} /></button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select value={card.condition} onChange={e => updateCard(i, 'condition', e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min="1" value={card.quantity}
                  onChange={e => updateCard(i, 'quantity', parseInt(e.target.value) || 1)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                  placeholder="Qty" />
                <input type="number" step="0.01" value={card.estimatedValue}
                  onChange={e => updateCard(i, 'estimatedValue', e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                  placeholder="$" />
              </div>
            </div>
          ))}
          <button onClick={() => setCards(c => [...c, { cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }])}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm">
            <Plus size={14} /> Add another card
          </button>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Message (optional)" rows={2}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none resize-none"
            style={{ fontSize: '16px' }} />
        </div>
        <div className="border-t border-white/10 p-4 flex-shrink-0">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition">
            {submitting ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, mode, onAccept, onReject, onCounter, onCancel }) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterCards, setCounterCards] = useState([{ cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }]);
  const [counterMessage, setCounterMessage] = useState('');

  const statusColors = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    accepted: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
    cancelled: 'text-white/40 bg-white/5',
    countered: 'text-blue-400 bg-blue-500/10',
  };

  const handleCounter = async () => {
    const valid = counterCards.filter(c => c.cardName.trim());
    if (valid.length === 0) return;
    await onCounter(offer._id, {
      offeredCards: valid.map(c => ({ ...c, estimatedValue: parseFloat(c.estimatedValue) || 0 })),
      message: counterMessage,
    });
    setShowCounter(false);
  };

  return (
    <div className="bg-white/10 rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white text-sm font-semibold">
            {mode === 'received' ? `From: ${offer.fromUsername}` : `To: ${offer.toUsername}`}
          </p>
          {offer.listingId && (
            <p className="text-white/50 text-xs">For: {offer.listingId.cardName}</p>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${statusColors[offer.status] || ''}`}>
          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
        </span>
      </div>

      <div>
        <p className="text-white/60 text-xs mb-1">Offering:</p>
        <div className="flex flex-wrap gap-1">
          {offer.offeredCards.map((card, i) => (
            <span key={i} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded">
              {card.quantity > 1 ? `${card.quantity}× ` : ''}{card.cardName} ({card.condition})
              {card.estimatedValue > 0 ? ` $${card.estimatedValue.toFixed(2)}` : ''}
            </span>
          ))}
        </div>
      </div>

      {offer.message && <p className="text-white/50 text-xs italic">"{offer.message}"</p>}

      {offer.status === 'countered' && offer.counterOffer && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-blue-400 text-xs font-semibold mb-1">Counter offer:</p>
          <div className="flex flex-wrap gap-1">
            {offer.counterOffer.offeredCards.map((card, i) => (
              <span key={i} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded">
                {card.quantity > 1 ? `${card.quantity}× ` : ''}{card.cardName} ({card.condition})
              </span>
            ))}
          </div>
          {offer.counterOffer.message && (
            <p className="text-white/50 text-xs italic mt-1">"{offer.counterOffer.message}"</p>
          )}
        </div>
      )}

      {mode === 'received' && offer.status === 'pending' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onAccept(offer._id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600/60 hover:bg-green-600 text-white text-xs rounded-lg transition">
            <Check size={12} /> Accept
          </button>
          <button onClick={() => setShowCounter(s => !s)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/60 hover:bg-blue-600 text-white text-xs rounded-lg transition">
            <RotateCcw size={12} /> Counter
          </button>
          <button onClick={() => onReject(offer._id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600/60 hover:bg-red-600 text-white text-xs rounded-lg transition">
            <X size={12} /> Reject
          </button>
        </div>
      )}

      {mode === 'sent' && ['pending', 'countered'].includes(offer.status) && (
        <button onClick={() => onCancel(offer._id)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/60 text-xs rounded-lg transition">
          Cancel Offer
        </button>
      )}

      {showCounter && (
        <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10">
          <p className="text-white/60 text-xs font-semibold">Your counter offer:</p>
          {counterCards.map((card, i) => (
            <div key={i} className="space-y-1">
              <input value={card.cardName}
                onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, cardName: e.target.value } : c))}
                placeholder="Card name"
                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none"
                style={{ fontSize: '16px' }} />
              <div className="grid grid-cols-3 gap-2">
                <select value={card.condition}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, condition: e.target.value } : c))}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min="1" value={card.quantity}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, quantity: parseInt(e.target.value) || 1 } : c))}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
                <input type="number" step="0.01" value={card.estimatedValue}
                  onChange={e => setCounterCards(cs => cs.map((c, idx) => idx === i ? { ...c, estimatedValue: e.target.value } : c))}
                  placeholder="$" className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
              </div>
            </div>
          ))}
          <button onClick={() => setCounterCards(cs => [...cs, { cardName: '', condition: 'NM', quantity: 1, estimatedValue: '' }])}
            className="text-purple-400 text-xs">+ Add card</button>
          <textarea value={counterMessage} onChange={e => setCounterMessage(e.target.value)}
            placeholder="Message..." rows={2}
            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs resize-none"
            style={{ fontSize: '16px' }} />
          <button onClick={handleCounter}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition">
            Send Counter
          </button>
        </div>
      )}
    </div>
  );
}

export default function TradingBoard() {
  const { user } = useAuthContext();
  const {
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, LIMIT,
    filterType, setFilterType, filterCard, setFilterCard,
    filterCondition, setFilterCondition, offset, setOffset,
    createListing, cancelListing, makeOffer, respondToOffer,
  } = useTrades();

  const [activeTab, setActiveTab] = useState('browse');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [offerTarget, setOfferTarget] = useState(null);
  const [comparisonTarget, setComparisonTarget] = useState(null);

  const pendingReceived = offersReceived.filter(o => o.status === 'pending').length;

  const tabs = [
    { id: 'browse', label: 'Browse' },
    { id: 'mine', label: 'My Listings' },
    { id: 'received', label: pendingReceived > 0 ? `Received (${pendingReceived})` : 'Received' },
    { id: 'sent', label: 'Sent' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={20} className="text-green-400" />
          <h2 className="text-xl font-bold text-white">Trading Board</h2>
        </div>
        {user && (
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/60 hover:bg-green-600 text-white text-sm rounded-lg transition">
            <Plus size={15} /> Post Listing
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-white/5 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition ${
              activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={filterCard} onChange={e => { setFilterCard(e.target.value); setOffset(0); }}
              placeholder="Search card name..."
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none"
              style={{ fontSize: '16px' }} />
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
              <option value="all">All Types</option>
              <option value="have">Have (for trade)</option>
              <option value="want">Want (looking for)</option>
            </select>
            <select value={filterCondition} onChange={e => { setFilterCondition(e.target.value); setOffset(0); }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none">
              <option value="">All Conditions</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
            </div>
          ) : listings.length === 0 ? (
            <p className="text-white/40 text-center py-12">No listings found. Be the first to post one!</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {listings.map(l => (
                  <ListingCard key={l._id} listing={l}
                    isOwn={user && l.userId === user._id?.toString()}
                    onOffer={user ? setOfferTarget : null}
                    onCompare={user ? setComparisonTarget : null} />
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-white/40 text-sm">{listingsTotal} listing{listingsTotal !== 1 ? 's' : ''}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg transition">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-white/60 text-sm">
                    {Math.floor(offset / LIMIT) + 1} / {Math.max(1, Math.ceil(listingsTotal / LIMIT))}
                  </span>
                  <button onClick={() => setOffset(o => o + LIMIT)} disabled={offset + LIMIT >= listingsTotal}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg transition">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="space-y-3">
          {!user ? (
            <p className="text-white/40 text-center py-8">Sign in to manage your listings</p>
          ) : myListings.length === 0 ? (
            <p className="text-white/40 text-center py-8">No listings yet. Click "Post Listing" to add one.</p>
          ) : (
            myListings.map(l => (
              <div key={l._id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <ListingCard listing={l} isOwn />
                </div>
                {l.status === 'active' ? (
                  <button onClick={() => cancelListing(l._id)}
                    className="p-2 bg-red-600/40 hover:bg-red-600 text-white rounded-lg transition flex-shrink-0"
                    title="Cancel listing">
                    <X size={15} />
                  </button>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                    l.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {l.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'received' && (
        <div className="space-y-3">
          {offersReceived.length === 0 ? (
            <p className="text-white/40 text-center py-8">No offers received yet</p>
          ) : (
            offersReceived.map(o => (
              <OfferCard key={o._id} offer={o} mode="received"
                onAccept={id => respondToOffer(id, 'accept')}
                onReject={id => respondToOffer(id, 'reject')}
                onCounter={(id, data) => respondToOffer(id, 'counter', data)}
                onCancel={null} />
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="space-y-3">
          {offersSent.length === 0 ? (
            <p className="text-white/40 text-center py-8">No offers sent yet</p>
          ) : (
            offersSent.map(o => (
              <OfferCard key={o._id} offer={o} mode="sent"
                onAccept={null} onReject={null} onCounter={null}
                onCancel={id => respondToOffer(id, 'cancel')} />
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateListingModal onClose={() => setShowCreateModal(false)} onCreate={createListing} />
      )}
      {offerTarget && (
        <MakeOfferModal listing={offerTarget} onClose={() => setOfferTarget(null)} onSubmit={makeOffer} />
      )}
      {comparisonTarget && (
        <CollectionComparison
          targetUsername={comparisonTarget}
          onClose={() => setComparisonTarget(null)}
        />
      )}
    </div>
  );
}
