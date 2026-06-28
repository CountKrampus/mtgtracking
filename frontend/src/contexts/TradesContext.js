import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from './AuthContext';
import { API_URL } from '../config';

const TradesContext = createContext(null);

const LIMIT = 20;

export function TradesProvider({ children }) {
  const { authFetch, user } = useAuthContext();

  const [listings, setListings] = useState([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [myListings, setMyListings] = useState([]);
  const [offersReceived, setOffersReceived] = useState([]);
  const [offersSent, setOffersSent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterType, setFilterType] = useState('all');
  const [filterCard, setFilterCard] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [offset, setOffset] = useState(0);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset });
      if (filterType !== 'all') params.set('type', filterType);
      if (filterCard) params.set('card', filterCard);
      if (filterCondition) params.set('condition', filterCondition);
      const res = await fetch(`${API_URL}/trades?${params}`);
      const data = await res.json();
      setListings(data.listings || []);
      setListingsTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCard, filterCondition, offset]);

  const fetchMyListings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`${API_URL}/trades/my-listings`);
      setMyListings(await res.json());
    } catch (err) {
      console.error('fetchMyListings:', err);
    }
  }, [authFetch, user]);

  const fetchOffers = useCallback(async () => {
    if (!user) return;
    try {
      const [recv, sent] = await Promise.all([
        authFetch(`${API_URL}/trades/offers/received`).then(r => r.json()),
        authFetch(`${API_URL}/trades/offers/sent`).then(r => r.json()),
      ]);
      setOffersReceived(Array.isArray(recv) ? recv : []);
      setOffersSent(Array.isArray(sent) ? sent : []);
    } catch (err) {
      console.error('fetchOffers:', err);
    }
  }, [authFetch, user]);

  const createListing = useCallback(async (data) => {
    const res = await authFetch(`${API_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings()]);
  }, [authFetch, fetchListings, fetchMyListings]);

  const cancelListing = useCallback(async (id) => {
    const res = await authFetch(`${API_URL}/trades/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchListings(), fetchMyListings()]);
  }, [authFetch, fetchListings, fetchMyListings]);

  const makeOffer = useCallback(async (listingId, offeredCards, message) => {
    const res = await authFetch(`${API_URL}/trades/${listingId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeredCards, message }),
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await fetchOffers();
  }, [authFetch, fetchOffers]);

  const respondToOffer = useCallback(async (offerId, action, counterData = null) => {
    const res = await authFetch(`${API_URL}/trades/offers/${offerId}/${action}`, {
      method: 'PUT',
      headers: counterData ? { 'Content-Type': 'application/json' } : {},
      body: counterData ? JSON.stringify(counterData) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).message);
    await Promise.all([fetchOffers(), fetchMyListings(), fetchListings()]);
  }, [authFetch, fetchOffers, fetchMyListings, fetchListings]);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { if (user) { fetchMyListings(); fetchOffers(); } }, [user, fetchMyListings, fetchOffers]);

  const value = useMemo(() => ({
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, error, LIMIT,
    filterType, setFilterType,
    filterCard, setFilterCard,
    filterCondition, setFilterCondition,
    offset, setOffset,
    fetchListings, fetchMyListings, fetchOffers,
    createListing, cancelListing, makeOffer, respondToOffer,
  }), [
    listings, listingsTotal, myListings, offersReceived, offersSent,
    loading, error, filterType, filterCard, filterCondition, offset,
    fetchListings, fetchMyListings, fetchOffers,
    createListing, cancelListing, makeOffer, respondToOffer,
  ]);

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>;
}

export function useTrades() {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error('useTrades must be used inside TradesProvider');
  return ctx;
}
