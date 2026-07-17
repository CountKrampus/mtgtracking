import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

// EditableRolePanel at module scope — prevents DOM remount on every render
function EditableRolePanel({ role, catalog, onSave, onCancel, saving }) {
  const [displayName, setDisplayName] = useState(role.displayName);
  const [permissions, setPermissions] = useState(new Set(role.permissions));

  const togglePermission = (key) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-gray-900 border border-purple-500/50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1 mr-2"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ displayName, permissions: Array.from(permissions) })}
            disabled={saving}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
          >
            <Save size={14} /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {Object.entries(catalog).map(([domain, entries]) => (
          <div key={domain} className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{domain}</h4>
            {entries.map(entry => (
              <label key={entry.key} className="flex items-start gap-2 text-sm text-gray-200 py-0.5">
                <input
                  type="checkbox"
                  checked={permissions.has(entry.key)}
                  onChange={() => togglePermission(entry.key)}
                  className="mt-1"
                />
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// NewRolePanel at module scope — prevents DOM remount on every render
function NewRolePanel({ catalog, onCreate, onCancel, saving }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [permissions, setPermissions] = useState(new Set());

  const togglePermission = (key) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-gray-900 border border-green-500/50 rounded-lg p-4 space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          placeholder="role_name (lowercase, underscores)"
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1"
        />
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Display Name"
          className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm flex-1"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {Object.entries(catalog).map(([domain, entries]) => (
          <div key={domain} className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{domain}</h4>
            {entries.map(entry => (
              <label key={entry.key} className="flex items-start gap-2 text-sm text-gray-200 py-0.5">
                <input
                  type="checkbox"
                  checked={permissions.has(entry.key)}
                  onChange={() => togglePermission(entry.key)}
                  className="mt-1"
                />
                <span>{entry.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCreate({ name, displayName, permissions: Array.from(permissions) })}
          disabled={saving || !name || !displayName}
          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
        >
          <Plus size={14} /> Create Role
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

export function PermissionsManagement() {
  const { authFetch } = useAuthContext();

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        authFetch(`${API_URL}/admin/roles`),
        authFetch(`${API_URL}/admin/roles/permissions-catalog`)
      ]);
      if (!rolesRes.ok) throw new Error(`Failed to load roles (${rolesRes.status})`);
      if (!catalogRes.ok) throw new Error(`Failed to load permission catalog (${catalogRes.status})`);
      const rolesData = await rolesRes.json();
      const catalogData = await catalogRes.json();
      setRoles(rolesData.roles || []);
      setCatalog(catalogData.catalog || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async (roleId, updates) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setEditingRoleId(null);
      await fetchAll();
    } catch (err) {
      alert(`Failed to save role: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      setCreating(false);
      await fetchAll();
    } catch (err) {
      alert(`Failed to create role: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.displayName}"? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`${API_URL}/admin/roles/${role._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Failed (${res.status})`);
      await fetchAll();
    } catch (err) {
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-center space-y-3">
        <p className="text-red-300 text-sm">{error}</p>
        <button
          onClick={fetchAll}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield size={18} className="text-purple-400" /> Roles & Permissions
        </h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <Plus size={14} /> New Role
          </button>
        )}
      </div>

      {creating && (
        <NewRolePanel
          catalog={catalog}
          saving={saving}
          onCreate={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="space-y-2">
        {roles.map(role => (
          <div key={role._id}>
            {editingRoleId === role._id ? (
              <EditableRolePanel
                role={role}
                catalog={catalog}
                saving={saving}
                onSave={updates => handleSave(role._id, updates)}
                onCancel={() => setEditingRoleId(null)}
              />
            ) : (
              <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{role.displayName}</span>
                    {role.isBuiltIn && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">Built-in</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {role.permissions.includes('all') ? 'All permissions' : `${role.permissions.length} permission(s)`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingRoleId(role._id)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  {!role.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(role)}
                      className="flex items-center gap-1 bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PermissionsManagement;
