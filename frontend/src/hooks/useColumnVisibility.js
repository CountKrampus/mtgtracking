import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const DEFAULT_COLUMNS = ['cardName', 'quantity', 'condition', 'price'];

const ALL_COLUMNS = [
  { id: 'cardName', label: 'Card Name', alwaysVisible: true, group: 'Card Info' },
  { id: 'set', label: 'Set', group: 'Card Info' },
  { id: 'setCode', label: 'Set Code', group: 'Card Info' },
  { id: 'collectorNumber', label: 'Collector #', group: 'Card Info' },
  { id: 'rarity', label: 'Rarity', group: 'Card Info' },
  { id: 'manaCost', label: 'Mana Cost', group: 'Card Info' },
  { id: 'colors', label: 'Colors', group: 'Card Info' },
  { id: 'types', label: 'Types', group: 'Card Info' },
  { id: 'quantity', label: 'Qty', alwaysVisible: true, group: 'Collection' },
  { id: 'condition', label: 'Condition', alwaysVisible: true, group: 'Collection' },
  { id: 'location', label: 'Location', group: 'Collection' },
  { id: 'foil', label: 'Foil', group: 'Collection' },
  { id: 'token', label: 'Token', group: 'Collection' },
  { id: 'tags', label: 'Tags', group: 'Collection' },
  { id: 'price', label: 'Price', alwaysVisible: true, group: 'Pricing' },
  { id: 'buylistValue', label: 'Buylist Value', group: 'Pricing' },
  { id: 'sellValue', label: 'Sell Value', group: 'Pricing' },
  { id: 'total', label: 'Total', group: 'Pricing' },
  { id: 'actions', label: 'Actions', group: 'Other' }
];

// Ordered list of group names, derived from column definition order
const COLUMN_GROUPS = [...new Set(ALL_COLUMNS.map(col => col.group))];

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

  const saveVisibleColumns = async (updated) => {
    const previous = visibleColumns;
    setVisibleColumns(updated);
    try {
      await axios.put(`${API_URL}/user/column-preferences`, {
        visibleColumns: updated
      });
    } catch (err) {
      console.error('Failed to save column preferences:', err);
      setVisibleColumns(previous);
    }
  };

  const selectAllColumns = () => saveVisibleColumns(ALL_COLUMNS.map(col => col.id));
  const resetColumns = () => saveVisibleColumns(DEFAULT_COLUMNS);

  return {
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    selectAllColumns,
    resetColumns,
    loading,
    allColumns: ALL_COLUMNS,
    columnGroups: COLUMN_GROUPS
  };
}
