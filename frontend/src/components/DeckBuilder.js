import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DeckList from './DeckList';
import DeckDetail from './DeckDetail';
import DeckImport from './DeckImport';
import DeckEditor from './DeckEditor';

const API_URL = 'http://localhost:5000/api';

function DeckBuilder() {
  const [decks, setDecks] = useState([]);
  const [currentDeck, setCurrentDeck] = useState(null);
  const [deckView, setDeckView] = useState('list'); // 'list', 'detail', 'import', 'edit'
  const [deckOwnership, setDeckOwnership] = useState(null);
  const [deckValidation, setDeckValidation] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [deckPlayCounts, setDeckPlayCounts] = useState({});

  useEffect(() => {
    fetchDecks();
    fetchLifecounterStats();
  }, []);

  const fetchDecks = async () => {
    try {
      const response = await axios.get(`${API_URL}/decks`);
      setDecks(response.data);
    } catch (error) {
      console.error('Error fetching decks:', error);
    }
  };

  const fetchLifecounterStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/lifecounter/stats`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Build deckId -> playData map
        const playMap = {};
        (data.mostPlayedDecks || []).forEach(d => {
          playMap[d.deckId.toString()] = d;
        });
        setDeckPlayCounts(playMap);
      }
    } catch (error) {
      console.error('Error fetching lifecounter stats:', error);
    }
  };

  const fetchDeckDetails = async (id) => {
    try {
      setLoadingDeck(true);
      const response = await axios.get(`${API_URL}/decks/${id}`);
      setCurrentDeck(response.data);

      const ownershipResponse = await axios.get(`${API_URL}/decks/${id}/ownership`);
      setDeckOwnership(ownershipResponse.data);

      const validationResponse = await axios.post(`${API_URL}/decks/${id}/validate`);
      setDeckValidation(validationResponse.data);
    } catch (error) {
      console.error('Error fetching deck details:', error);
    } finally {
      setLoadingDeck(false);
    }
  };

  const deleteDeck = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deck?')) return;

    try {
      await axios.delete(`${API_URL}/decks/${id}`);
      await fetchDecks();
    } catch (error) {
      alert('Error deleting deck: ' + error.message);
    }
  };

  return (
    <div>
      {deckView === 'list' && (
        <DeckList
          decks={decks}
          onViewDeck={(deck) => {
            setCurrentDeck(deck);
            fetchDeckDetails(deck._id);
            setDeckView('detail');
          }}
          onDeleteDeck={deleteDeck}
          onImportClick={() => setDeckView('import')}
          deckPlayCounts={deckPlayCounts}
        />
      )}

      {deckView === 'detail' && currentDeck && (
        <DeckDetail
          deck={currentDeck}
          ownership={deckOwnership}
          validation={deckValidation}
          loading={loadingDeck}
          onBack={() => {
            setDeckView('list');
            setCurrentDeck(null);
            setDeckOwnership(null);
          }}
          onRefresh={() => fetchDeckDetails(currentDeck._id)}
          onEdit={() => setDeckView('edit')}
        />
      )}

      {deckView === 'edit' && currentDeck && (
        <DeckEditor
          deck={currentDeck}
          onSave={(updatedDeck) => {
            setCurrentDeck(updatedDeck);
            fetchDeckDetails(updatedDeck._id);
            setDeckView('detail');
          }}
          onCancel={() => setDeckView('detail')}
        />
      )}

      {deckView === 'import' && (
        <DeckImport
          onBack={() => setDeckView('list')}
          onImportComplete={() => {
            fetchDecks();
            setDeckView('list');
          }}
        />
      )}
    </div>
  );
}

export default DeckBuilder;
