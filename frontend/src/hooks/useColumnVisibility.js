import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const DEFAULT_COLUMNS = ['cardName', 'quantity', 'condition', 'price'];

const ALL_COLUMNS = [
  { id: 'cardName', label: 'Card Name', alwaysVisible: true },
  { id: 'set', label: 'Set' },
  { id: 'setCode', label: 'Set Code' },
  { id: 'collectorNumber', label: 'Collector #' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'manaCost', label: 'Mana Cost' },
  { id: 'colors', label: 'Colors' },
  { id: 'types', label: 'Types' },
  { id: 'location', label: 'Location' },
  { id: 'foil', label: 'Foil' },
  { id: 'token', label: 'Token' },
  { id: 'tags', label: 'Tags' },
  { id: 'quantity', label: 'Qty', alwaysVisible: true },
  { id: 'condition', label: 'Condition', alwaysVisible: true },
  { id: 'price', label: 'Price', alwaysVisible: true },
  { id: 'buylistValue', label: 'Buylist Value' },
  { id: 'sellValue', label: 'Sell Value' },
  { id: 'total', label: 'Total' },
  { id: 'actions', label: 'Actions' }
];

export default function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await axios.get(`${API_URL}/user/column-preferences`);
        setVisibleColumns(response.data.visibleColumns || DEFAULT_COLUMNS);
      } catch (err) {
        console.error('Failed to fetch column preferences:', err);
        setVisibleColumns(DEFAULT_COLUMNS);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const toggleColumn = async (columnId) => {
    const updated = visibleColumns.includes(columnId)
      ? visibleColumns.filter(c => c !== columnId)
      : [...visibleColumns, columnId];

    setVisibleColumns(updated);

    try {
      await axios.put(`${API_URL}/user/column-preferences`, {
        visibleColumns: updated
      });
    } catch (err) {
      console.error('Failed to save column preferences:', err);
      setVisibleColumns(visibleColumns);
    }
  };

  const isColumnVisible = (columnId) => visibleColumns.includes(columnId);

  return {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    loading,
    allColumns: ALL_COLUMNS
  };
}
