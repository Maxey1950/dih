'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, errorMessage } from '../../lib/api';

const STATUS_BADGE = { online: 'bg-success', starting: 'bg-info', draining: 'bg-warning text-dark', offline: 'bg-secondary' };

/**
 * Read-only view of the game-server registry for admins. Shows no addresses
 * or credentials, and offers no remote actions or commands by design.
 */
export default function GameServersCard() {
  const [servers, setServers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.servers();
      setServers(data.servers);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load game servers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  return (
    <div className="card shadow-sm border-0 mt-4">
      <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-hdd-network me-2"></i>Game Servers</h5>
        <button className="btn btn-light btn-sm" onClick={load}><i className="bi bi-arrow-clockwise"></i></button>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-4"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>
        ) : error ? (
          <div className="alert alert-danger m-3">{error}</div>
        ) : servers.length === 0 ? (
          <p className="text-body-secondary text-center py-4 mb-0">No game servers are registered.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr><th className="ps-3">Server</th><th>Game</th><th>Status</th><th>Players</th><th>Last heartbeat</th></tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id}>
                    <td className="ps-3"><code className="small">{s.id}</code></td>
                    <td><Link href={`/games/${s.game.id}`}>{s.game.name}</Link> <span className="small text-body-secondary">(place {s.game.placeId})</span></td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                      {s.isStale && s.status !== 'offline' && <span className="badge bg-danger ms-1">stale</span>}
                    </td>
                    <td>{s.playerCount} / {s.maxPlayers}</td>
                    <td className="small">{s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).toLocaleString() : 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
