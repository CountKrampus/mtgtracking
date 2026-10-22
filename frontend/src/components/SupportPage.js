import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Heart, Users } from 'lucide-react';
import axios from 'axios';
import { API_URL, SUPPORT_URL } from '../config';

function getDonationUrl() {
  if (!SUPPORT_URL) return '';
  try {
    const url = new URL(SUPPORT_URL);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function SupportPage({ authUser }) {
  const donationUrl = useMemo(getDonationUrl, []);
  const [supporters, setSupporters] = useState([]);
  const [recognitionEnabled, setRecognitionEnabled] = useState(false);
  const [hasSupporterBadge, setHasSupporterBadge] = useState(false);
  const [loadingSupporters, setLoadingSupporters] = useState(true);
  const [savingRecognition, setSavingRecognition] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/users/supporters`)
      .then(response => {
        if (active) setSupporters(response.data);
      })
      .catch(() => {
        if (active) setError('Could not load the supporter list. Please try again later.');
      })
      .finally(() => {
        if (active) setLoadingSupporters(false);
      });

    if (authUser?._id) {
      axios.get(`${API_URL}/users/me`)
        .then(response => {
          if (!active) return;
          setRecognitionEnabled(Boolean(response.data.privacy?.supportRecognition));
          setHasSupporterBadge(
            (response.data.badges || []).some(badge => badge.name === 'Supporter')
          );
        })
        .catch(() => {
          if (active) setError('Could not load your supporter settings.');
        });
    }

    return () => { active = false; };
  }, [authUser?._id]);

  const updateRecognition = async (enabled) => {
    setSavingRecognition(true);
    setError('');
    try {
      const response = await axios.put(`${API_URL}/users/me`, {
        privacy: { supportRecognition: enabled },
      });
      setRecognitionEnabled(Boolean(response.data.privacy?.supportRecognition));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update your public recognition setting.');
    } finally {
      setSavingRecognition(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="bg-gradient-to-br from-purple-900/70 to-pink-900/40 border border-purple-400/30 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <Heart className="text-pink-300" size={28} />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Support MTG Tracker</h1>
        </div>
        <p className="text-white/75 max-w-2xl">
          If MTG Tracker has been useful to you, an optional contribution helps with hosting and ongoing development.
          The app’s core features stay available to everyone; support does not unlock gameplay or collection advantages.
        </p>
        {donationUrl ? (
          <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-semibold transition"
          >
            <Heart size={18} /> Visit the support page <ExternalLink size={16} />
          </a>
        ) : (
          <p className="mt-5 px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white/65">
            Contributions are not configured yet. The site administrator can set a hosted donation-page URL with
            <code className="mx-1 text-white">REACT_APP_SUPPORT_URL</code> and rebuild the frontend.
          </p>
        )}
        <p className="mt-3 text-xs text-white/50">
          Contributions are voluntary and handled by the linked provider. MTG Tracker does not collect payment details.
        </p>
      </header>

      {error && (
        <div role="alert" className="p-3 bg-red-900/40 border border-red-500/40 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-xl font-bold text-white mb-2">Community recognition</h2>
        <p className="text-sm text-white/65 mb-4">
          Supporters can receive a cosmetic Supporter badge. An administrator verifies contributions manually and
          grants the badge. After contributing, contact a site administrator privately with your account username;
          never send payment details or receipts through the app. There is no payment-account linking or automatic tracking.
        </p>
        {authUser?._id ? (
          hasSupporterBadge ? (
            <label className="flex items-start gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={recognitionEnabled}
                disabled={savingRecognition}
                onChange={event => updateRecognition(event.target.checked)}
                className="mt-1 accent-purple-500"
              />
              <span>
                <span className="block text-white font-medium">Show my supporter recognition publicly</span>
                <span className="block text-xs text-white/50 mt-1">
                  Your display name, username, and avatar will appear in the public supporters list. You can turn this off any time.
                </span>
              </span>
            </label>
          ) : (
            <p className="p-3 bg-white/5 rounded-lg text-sm text-white/60">
              Once an administrator has verified your contribution and granted the Supporter badge, you can opt in to the public list here.
              Please do not post payment receipts or financial details in the app.
            </p>
          )
        ) : (
          <p className="text-sm text-white/60">Sign in to manage public supporter recognition.</p>
        )}
      </section>

      <section className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-purple-300" size={20} />
          <h2 className="text-xl font-bold text-white">Community supporters</h2>
        </div>
        {loadingSupporters ? (
          <p className="text-sm text-white/50">Loading supporters…</p>
        ) : supporters.length === 0 ? (
          <p className="text-sm text-white/50">No supporters have opted in to be listed yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supporters.map(supporter => (
              <li key={supporter.username} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                {supporter.avatarUrl ? (
                  <img src={supporter.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold">
                    {(supporter.displayName || supporter.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">{supporter.displayName}</div>
                  <div className="text-xs text-white/45">@{supporter.username}</div>
                </div>
                <span className="ml-auto text-xs text-purple-200 bg-purple-500/15 border border-purple-400/20 rounded-full px-2 py-1">
                  Supporter
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default SupportPage;
