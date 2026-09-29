'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RequireAuth from '../../../components/auth/RequireAuth';
import GameForm from '../../../components/games/GameForm';
import { useAuth } from '../../../contexts/AuthContext';
import { gamesApi, errorMessage } from '../../../lib/api';

/**
 * Create a game and list your places. No place-file upload yet: every game
 * gets a server-allocated placeId, and place files attach in a later phase
 * (see docs/phase-3-games.md).
 */
function CreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [myGames, setMyGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [listError, setListError] = useState(null);

  const loadMine = useCallback(async () => {
    try {
      const data = await gamesApi.byUser(user.id, { limit: 48 });
      setMyGames(data.games);
      setListError(null);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load your places.'));
    } finally {
      setLoadingGames(false);
    }
  }, [user.id]);

  useEffect(() => {
    const first = setTimeout(loadMine, 0);
    return () => clearTimeout(first);
  }, [loadMine]);

  const create = async (values) => {
    try {
      const { game } = await gamesApi.create(values);
      router.push(`/games/${game.id}`);
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not create the game.'));
    }
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary min-vh-100">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0"><i className="bi bi-plus-square me-2"></i>Create a New Game</h5>
              </div>
              <div className="card-body">
                <GameForm submitLabel="Create Game" onSubmit={create} />
                <p className="text-body-secondary small mt-3 mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Uploading place files is not available yet. New games start empty and can be made public at any time.
                </p>
              </div>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-body">
                <span className="fw-semibold">My Places</span>
              </div>
              <div className="card-body">
                {loadingGames ? (
                  <div className="text-center py-3"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>
                ) : listError ? (
                  <div className="alert alert-danger mb-0">{listError}</div>
                ) : myGames.length === 0 ? (
                  <p className="text-body-secondary text-center mb-0">You haven't created any games yet.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {myGames.map((g) => (
                      <li key={g.id} className="list-group-item d-flex align-items-center px-0">
                        <img src={g.thumbnailUrl} alt="" className="rounded me-3" style={{ width: 64, height: 48, objectFit: 'cover' }} />
                        <div className="flex-grow-1 text-truncate">
                          <Link href={`/games/${g.id}`} className="fw-semibold text-decoration-none">{g.name}</Link>
                          <div className="small text-body-secondary">
                            {g.isPublic ? 'Public' : 'Private'} · {g.playerCount} playing
                          </div>
                        </div>
                        <Link href={`/games/${g.id}/edit`} className="btn btn-outline-primary btn-sm ms-2">Edit</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Create() {
  return (
    <RequireAuth>
      <CreatePage />
    </RequireAuth>
  );
}
