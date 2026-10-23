import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeftRight, Loader2, RotateCcw } from 'lucide-react';
import { API_URL } from '../config';

export default function CardLoansView({ cards = [] }) {
  const [loans, setLoans] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [borrower, setBorrower] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshLoans = async () => {
    const { data } = await axios.get(`${API_URL}/card-loans`);
    setLoans(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/card-loans`)
      .then(({ data }) => { if (!cancelled) setLoans(Array.isArray(data) ? data : []); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'Could not load lending records.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const outByCard = useMemo(() => {
    const totals = new Map();
    loans.filter(loan => loan.status === 'out').forEach(loan => {
      totals.set(loan.cardId, (totals.get(loan.cardId) || 0) + loan.quantity);
    });
    return totals;
  }, [loans]);

  const availableCards = useMemo(() => cards
    .map(card => ({ ...card, available: Math.max(0, (card.quantity || 0) - (outByCard.get(card._id) || 0)) }))
    .filter(card => card.available > 0)
    .sort((a, b) => a.name.localeCompare(b.name)), [cards, outByCard]);

  useEffect(() => {
    if (!availableCards.some(card => card._id === selectedCardId)) {
      setSelectedCardId(availableCards[0]?._id || '');
    }
  }, [availableCards, selectedCardId]);

  const selectedCard = availableCards.find(card => card._id === selectedCardId);
  const outstanding = loans.filter(loan => loan.status === 'out');
  const returned = loans.filter(loan => loan.status === 'returned');

  const lendCard = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await axios.post(`${API_URL}/card-loans`, {
        cardId: selectedCardId,
        borrower,
        quantity: Number(quantity),
        dueDate: dueDate || null,
        notes
      });
      await refreshLoans();
      setBorrower('');
      setQuantity(1);
      setDueDate('');
      setNotes('');
      setNotice('Loan recorded.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record this loan.');
    } finally {
      setSaving(false);
    }
  };

  const markReturned = async loan => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await axios.put(`${API_URL}/card-loans/${loan._id}/return`);
      await refreshLoans();
      setNotice(`${loan.cardName} marked as returned.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not mark this loan as returned.');
    } finally {
      setSaving(false);
    }
  };

  const dueLabel = loan => {
    if (!loan.dueDate) return 'No due date';
    const dueDay = new Date(loan.dueDate).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const daysLeft = (Date.parse(`${dueDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}`;
    if (daysLeft === 0) return 'Due today';
    return `Due ${new Date(`${dueDay}T00:00:00`).toLocaleDateString()}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <ArrowLeftRight size={28} className="text-purple-300" />
        <div>
          <h1 className="text-2xl font-bold text-white">Card lending</h1>
          <p className="text-sm text-white/55 mt-1">Track who has your cards, due dates, and returns.</p>
        </div>
      </header>

      <form onSubmit={lendCard} className="bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <label className="text-sm text-white/70 lg:col-span-2">Card
          <select value={selectedCardId} onChange={event => setSelectedCardId(event.target.value)} required disabled={!availableCards.length}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20">
            {availableCards.length ? availableCards.map(card => (
              <option key={card._id} value={card._id}>{card.name} · {card.set || 'Unknown set'} · {card.available} available</option>
            )) : <option value="">No copies available to lend</option>}
          </select>
        </label>
        <label className="text-sm text-white/70">Borrower
          <input value={borrower} onChange={event => setBorrower(event.target.value)} required maxLength={100}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20" placeholder="Name" />
        </label>
        <label className="text-sm text-white/70">Copies
          <input type="number" min="1" max={selectedCard?.available || 1} step="1" value={quantity}
            onChange={event => setQuantity(event.target.value)} required
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20" />
        </label>
        <label className="text-sm text-white/70">Due date
          <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20" />
        </label>
        <label className="text-sm text-white/70 sm:col-span-2 lg:col-span-4">Notes
          <input value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20" placeholder="Optional note" />
        </label>
        <button type="submit" disabled={saving || !availableCards.length} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">
          {saving ? 'Saving...' : 'Record loan'}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-teal-400/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">{notice}</p>}

      <section className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Outstanding loans ({outstanding.length})</h2>
        {loading ? <p className="text-white/55 flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading loans...</p>
          : outstanding.length === 0 ? <p className="text-sm text-white/50">No cards are currently lent out.</p>
            : <div className="space-y-2">
              {outstanding.map(loan => {
                const overdue = loan.dueDate && new Date(loan.dueDate).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
                return <article key={loan._id} className="flex flex-wrap items-center justify-between gap-3 bg-black/15 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{loan.cardName} <span className="text-white/50">×{loan.quantity}</span></p>
                    <p className="text-xs text-white/55">{loan.set} · {loan.condition} · Lent to {loan.borrower}</p>
                    <p className={`text-xs mt-1 ${overdue ? 'text-red-300' : 'text-white/45'}`}>{dueLabel(loan)}{loan.notes ? ` · ${loan.notes}` : ''}</p>
                  </div>
                  <button onClick={() => markReturned(loan)} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm disabled:opacity-50">
                    <RotateCcw size={15} />Mark returned
                  </button>
                </article>;
              })}
            </div>}
      </section>

      {returned.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Recently returned</h2>
          <div className="space-y-2">
            {returned.slice(0, 10).map(loan => <div key={loan._id} className="flex justify-between gap-3 text-sm text-white/60">
              <span>{loan.cardName} ×{loan.quantity} · {loan.borrower}</span>
              <span>{loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString() : 'Returned'}</span>
            </div>)}
          </div>
        </section>
      )}
    </div>
  );
}
