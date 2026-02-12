import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DeckList from './DeckList';
import DeckDetail from './DeckDetail';
import DeckImport from './DeckImport';

const API_URL = 'http://localhost:5000/api';

function DeckBuilder() {
  const [decks, setDecks] = useState([]);
  const [currentDeck, setCurrentDeck] = useState(null);
  const [deckView, setDeckView] = useState('list'); // 'list', 'detail', 'import'
  const [deckOwnership, setDeckOwnership] = useState(null);
  const [deckValidation, setDeckValidation] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    try {
      const response = await axios.get(`${API_URL}/decks`);
      setDecks(response.data);
    } catch (error) {
      console.error('Error fetching decks:', error);
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
