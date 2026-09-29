'use client';

import { useState } from 'react';

/**
 * Create/edit form for a game. Only the fields a creator may change are
 * here; the creator, place id, stats and thumbnail are set by the server.
 * Limits mirror shared/src/schemas.ts (CreateGameRequest).
 */
export default function GameForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    maxPlayers: initial?.maxPlayers ?? 12,
    isPublic: initial?.isPublic ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const maxPlayers = Number(form.maxPlayers);
    if (!form.name.trim()) return setError('Game name is required.');
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 100) {
      return setError('Max players must be a whole number from 1 to 100.');
    }
    setSaving(true);
    try {
      await onSubmit({ name: form.name.trim(), description: form.description, maxPlayers, isPublic: form.isPublic });
    } catch (err) {
      setError(err?.message || 'Could not save the game.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="gameName" className="form-label">Name</label>
        <input id="gameName" type="text" className="form-control" maxLength={50} required value={form.name} onChange={set('name')} />
        <div className="form-text">Up to 50 characters.</div>
      </div>
      <div className="mb-3">
        <label htmlFor="gameDescription" className="form-label">Description</label>
        <textarea id="gameDescription" className="form-control" rows={4} maxLength={1000} value={form.description} onChange={set('description')} />
        <div className="form-text">{1000 - form.description.length} characters remaining</div>
      </div>
      <div className="row">
        <div className="col-md-4 mb-3">
          <label htmlFor="gameMaxPlayers" className="form-label">Max Players</label>
          <input id="gameMaxPlayers" type="number" className="form-control" min={1} max={100} step={1} required value={form.maxPlayers} onChange={set('maxPlayers')} />
        </div>
        <div className="col-md-8 mb-3 d-flex align-items-end">
          <div className="form-check form-switch mb-2">
            <input id="gamePublic" className="form-check-input" type="checkbox" role="switch" checked={form.isPublic} onChange={set('isPublic')} />
            <label htmlFor="gamePublic" className="form-check-label">Public (listed on the Games page)</label>
          </div>
        </div>
      </div>
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-success" disabled={saving}>
          {saving && <span className="spinner-border spinner-border-sm me-2" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        )}
      </div>
    </form>
  );
}
