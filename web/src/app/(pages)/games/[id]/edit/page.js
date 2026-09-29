'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import RequireAuth from '../../../../../components/auth/RequireAuth';
import GameForm from '../../../../../components/games/GameForm';
import LoadingSpinner from '../../../../../components/LoadingSpinner';
import { gamesApi, errorMessage } from '../../../../../lib/api';

/** Edit a game. The API enforces ownership (creator or admin); this page only reflects it. */
function EditGamePage() {
  const { id } = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    gamesApi
      .get(id)
      .then(({ game: g }) => {
        if (cancelled) return;
        if (!g.canEdit) setError('You can only edit your own games.');
        setGame(g);
      })
      .catch((err) => !cancelled && setError(err?.status === 404 ? 'Game not found.' : errorMessage(err, 'Could not load the game.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async (values) => {
    try {
      await gamesApi.update(id, values);
      router.push(`/games/${id}`);
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not save the game.'));
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this game? It will be unpublished and hidden.')) return;
    setDeleting(true);
    try {
      await gamesApi.remove(id);
      router.push('/create');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the game.'));
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container-fluid py-5 bg-body-tertiary min-vh-100">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0"><i className="bi bi-pencil-square me-2"></i>Edit Game</h5>
              </div>
              <div className="card-body">
                {error || !game?.canEdit ? (
                  <>
                    <div className="alert alert-danger" role="alert">{error || 'You can only edit your own games.'}</div>
                    <Link href={game ? `/games/${id}` : '/games'} className="btn btn-outline-primary">
                      <i className="bi bi-arrow-left me-2"></i>Back
                    </Link>
                  </>
                ) : (
                  <>
                    <GameForm initial={game} submitLabel="Save Changes" onSubmit={save} onCancel={() => router.push(`/games/${id}`)} />
                    <hr />
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small text-body-secondary">Place ID: {game.placeId}</span>
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={remove} disabled={deleting}>
                        <i className="bi bi-trash me-1"></i>Delete Game
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditGame() {
  return (
    <RequireAuth>
      <EditGamePage />
    </RequireAuth>
  );
}
