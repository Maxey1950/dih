'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { approvalRating, playGame } from '../../../../lib/games';
import { gamesApi, errorMessage } from '../../../../lib/api';
import { siteConfig } from '../../../../../config/site';

const REFRESH_MS = 30_000;

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : 'N/A';
}

export default function Page() {
  const { id } = useParams();

  // All hooks run unconditionally, before any early return (Rules of Hooks).
  const [game, setGame] = useState(null);
  const [recommended, setRecommended] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showPlayModal, setShowPlayModal] = useState(false);
  // { kind: 'launching' } or { kind: 'error', reason, message }
  const [playState, setPlayState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  // Game + live servers; refreshed periodically so player counts stay current.
  const refresh = useCallback(async () => {
    try {
      const [{ game: g }, { servers: live }] = await Promise.all([gamesApi.get(id), gamesApi.servers(id)]);
      setGame(g);
      setServers(live);
      setLoadError(null);
    } catch (err) {
      if (err?.status === 404) setGame(null);
      else setLoadError(errorMessage(err, 'Failed to load this game.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    gamesApi
      .list({ sort: 'players', limit: 3 })
      .then((data) => !cancelled && setRecommended(data.games.filter((other) => other.id !== id).slice(0, 2)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      const result = await playGame(game.id);
      setPlayState(result.ok ? { kind: 'launching' } : { kind: 'error', reason: result.reason, message: result.message });
      setShowPlayModal(true);
    } finally {
      setIsPlaying(false);
    }
  };

  const closePlayModal = () => {
    setShowPlayModal(false);
  };

  if (loading) {
    return (
      <div className="container-fluid py-5 bg-body-tertiary min-vh-100">
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container-fluid py-5 bg-body-tertiary">
        <div className="container">
          <div className={`alert ${loadError ? 'alert-danger' : 'alert-info'}`} role="alert">
            {loadError || 'Game not found'}
          </div>
          <Link href="/games" className="btn btn-outline-primary mt-3">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  const description = (game.description ?? '').trim() || 'No Description';
  const rating = approvalRating(game);

  return (
    <div className="container-fluid py-5 bg-body-tertiary min-vh-100">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
                <h1 className="h5 mb-0 fw-bold">{game.name}</h1>
                <span className="badge bg-light text-primary">{game.isPublic ? (game.genre || 'All') : 'Private'}</span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6 col-lg-7 mb-3 mb-lg-0">
                    <div className="ratio ratio-16x9 bg-body rounded">
                      <img src={game.thumbnailUrl} alt={game.name} className="w-100 h-100 object-fit-contain p-2" />
                    </div>
                  </div>

                  <div className="col-md-6 col-lg-5 d-flex flex-column">
                    <div className="mb-3">
                      <h2 className="h4 mb-1 fw-bold">{game.name}</h2>
                      <div className="text-body-secondary">
                        By{' '}
                        <Link href={`/user/${game.creator.id}/profile`}>
                          {game.creator.displayName}
                        </Link>
                      </div>
                      {game.canEdit && (
                        <Link href={`/games/${game.id}/edit`} className="btn btn-outline-primary btn-sm mt-2">
                          <i className="bi bi-pencil me-1"></i>Edit Game
                        </Link>
                      )}
                    </div>


                    <div className="mt-auto">
                      <div className="d-grid gap-2 mb-3">
                        <button
                          className="btn btn-success rounded btn-lg d-flex align-items-center justify-content-center"
                          type="button"
                          onClick={handlePlay}
                          disabled={isPlaying}
                        >
                          {isPlaying && (
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          )}
                          <i className="bi bi-controller me-2"></i>
                          {isPlaying ? 'Launching...' : 'Play'}
                        </button>
                      </div>
                      <div>
                        <div className="progress" style={{ height: 6 }}>
                          <div className="progress-bar bg-success" style={{ width: `${rating}%` }} aria-valuenow={rating} aria-valuemin="0" aria-valuemax="100"></div>
                          <div className="progress-bar bg-danger" style={{ width: `${100 - rating}%` }} aria-valuenow={100 - rating} aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div className="d-flex justify-content-between mt-2">
                          <button type="button" className="btn btn-link text-success p-0 d-flex align-items-center" onClick={() => setShowVoteModal(true)}>
                            <i className="bi bi-hand-thumbs-up me-1"></i>{game.upVotes ?? 0}
                          </button>
                                                    <span className="text-body-secondary">{rating}% approval</span>

                          <button type="button" className="btn btn-link text-danger p-0 d-flex align-items-center" onClick={() => setShowVoteModal(true)}>
                            <i className="bi bi-hand-thumbs-down me-1"></i>{game.downVotes ?? 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>



                {showVoteModal && (
                  <>
                    <div className="modal fade show d-block" aria-labelledby="voteModalLabel" aria-modal="true" role="dialog">
                      <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                          <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title" id="voteModalLabel">Voting Unavailable</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={() => setShowVoteModal(false)} aria-label="Close"></button>
                          </div>
                          <div className="modal-body text-center">
                            <i className="bi bi-controller fs-1 text-primary d-block mb-3"></i>
                            <p className="mb-0">You cannot vote until you join the game.</p>
                          </div>
                          <div className="modal-footer d-flex justify-content-end">
                            <button type="button" className="btn btn-outline-primary" onClick={() => setShowVoteModal(false)}>Close</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="modal-backdrop show"></div>
                  </>
                )}

                {showPlayModal && (
                  <>
                    <div className="modal fade show d-block" aria-labelledby="playModalLabel" aria-modal="true" role="dialog">
                      <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                          <div className={`modal-header ${playState?.kind === 'launching' ? 'bg-success' : 'bg-primary'} text-white`}>
                            <h5 className="modal-title" id="playModalLabel">{playState?.kind === 'launching' ? 'Starting Game...' : 'Launch Game'}</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={closePlayModal} aria-label="Close"></button>
                          </div>
                          {playState?.kind === 'launching' ? (
                            <div className="modal-body text-center">
                              <div className="spinner-border text-success mb-3" role="status"><span className="visually-hidden">Starting...</span></div>
                              <p className="mb-2">Your game is starting in the {siteConfig.name} launcher.</p>
                              <p className="text-body-secondary small mb-3">
                                If nothing happens, the launcher may not be installed. Install it, then press Play again
                                (each Play link works once and expires after 90 seconds).
                              </p>
                              {siteConfig.launcherDownloadUrl ? (
                                <a href={siteConfig.launcherDownloadUrl} className="btn btn-success"><i className="bi bi-download me-2"></i>Download Launcher</a>
                              ) : (
                                <button type="button" className="btn btn-success disabled"><i className="bi bi-download me-2"></i>Download Launcher</button>
                              )}
                            </div>
                          ) : (
                            <div className="modal-body text-center">
                              <i className="bi bi-controller fs-1 text-primary d-block mb-3"></i>
                              <p className="mb-3">{playState?.message}</p>
                              {playState?.reason === 'UNAUTHENTICATED' && (
                                <Link href={`/login?returnUrl=${encodeURIComponent(`/games/${game.id}`)}`} className="btn btn-primary">Log In</Link>
                              )}
                            </div>
                          )}
                          <div className="modal-footer d-flex justify-content-end">
                            <button type="button" className="btn btn-outline-primary" onClick={closePlayModal}>Close</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="modal-backdrop show"></div>
                  </>
                )}
              </div>
            </div>
            <div className="card shadow-sm border-0 mt-4">
              <div className="card-body">
                <ul className="nav nav-underline nav-justified w-100 border-bottom mb-0" role="tablist">
                  <li className="nav-item" role="presentation">
                    <button className={`nav-link w-100 py-2 ${activeTab === 'stats' ? 'active text-primary' : 'text-secondary'}`} type="button" role="tab" onClick={() => setActiveTab('stats')}>Stats</button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button className={`nav-link w-100 py-2 ${activeTab === 'store' ? 'active text-primary' : 'text-secondary'}`} type="button" role="tab" onClick={() => setActiveTab('store')}>Store</button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button className={`nav-link w-100 py-2 ${activeTab === 'leaderboard' ? 'active text-primary' : 'text-secondary'}`} type="button" role="tab" onClick={() => setActiveTab('leaderboard')}>Leaderboards</button>
                  </li>
                </ul>
                <div className="tab-content py-3  border-top-0 rounded-bottom">
                  <div className={`tab-pane fade ${activeTab === 'stats' ? 'show active' : ''}`} id="stats" role="tabpanel">
                    <div className="d-flex align-items-center mb-2">
                      <span className="text-uppercase fw-semibold me-3">Description</span>
                    </div>
                    <p className="text-body-secondary small mb-3">{description}</p>
                    <hr className="my-3 border-top border-secondary" />
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="card border-0 bg-body h-100">
                          <div className="card-body">
                            <div className="row text-center g-3">
                              <div className="col-6">
                                <div className="text-body-secondary">Created</div>
                                <div className="h6 mb-0">{formatDate(game.createdAt)}</div>
                              </div>
                              <div className="col-6">
                                <div className="text-body-secondary">Updated</div>
                                <div className="h6 mb-0">{formatDate(game.updatedAt)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 bg-body h-100">
                          <div className="card-body">
                            <div className="row text-center g-3">
                              <div className="col-6">
                                <div className="text-body-secondary">Visits</div>
                                <div className="h6 mb-0">{(game.visits ?? 0).toLocaleString()}</div>
                              </div>
                              <div className="col-6">
                                <div className="text-body-secondary">Max Players</div>
                                <div className="h6 mb-0">{game.maxPlayers}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`tab-pane fade ${activeTab === 'store' ? 'show active' : ''}`} id="store" role="tabpanel">
                    <div className="text-body-secondary">No store items available.</div>
                  </div>
                  <div className={`tab-pane fade ${activeTab === 'leaderboard' ? 'show active' : ''}`} id="leaderboard" role="tabpanel">
                    <div className="text-body-secondary">No leaderboard currently available.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card shadow-sm border-0 mt-4 mb-4">
              <div className="card-header bg-body">
                <span className="fw-semibold">Servers</span>
              </div>
              <div className="card-body">
                {servers.length === 0 ? (
                  <p className="text-body-secondary text-center mb-0">There are currently no servers running for this place.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {servers.map((server, i) => (
                      <li key={server.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                        <span>
                          <i className="bi bi-hdd-network me-2 text-primary"></i>Server {i + 1}
                          {server.status === 'draining' && <span className="badge bg-secondary ms-2">Closing</span>}
                        </span>
                        <span className="text-body-secondary">{server.playerCount} / {server.maxPlayers} players</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-body">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="fw-semibold">Game Info</span>
                  <span className="badge bg-primary-subtle text-primary">Details</span>
                </div>
              </div>
              <div className="card-body">
                <ul className="list-unstyled mb-0 text-body-secondary">
                  <li className="mb-2"><i className="bi bi-rocket-takeoff me-2"></i>{game.genre || 'All genres'}</li>
                  <li className="mb-2"><i className="bi bi-people me-2"></i>{game.playerCount} playing</li>
                  <li><i className="bi bi-bar-chart me-2"></i>{(game.visits ?? 0).toLocaleString()} visits</li>
                </ul>
              </div>
            </div>

            <div className="card shadow-sm border-0">
              <div className="card-header bg-body">
                <span className="fw-semibold">Recommended</span>
              </div>
              <div className="card-body">
                    <div className="row g-3">
                  {recommended.map((rec) => (
                    <div className="col-6" key={rec.id}>
                      <Link href={`/games/${rec.id}`} className="text-decoration-none">
                        <div className="card h-100">
                          <img src={rec.thumbnailUrl} alt="Recommended" className="card-img-top" />
                          <div className="card-body p-2">
                            <div className="small text-truncate">{rec.name}</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>


        </div>

        
      </div>
    </div>
  );
}