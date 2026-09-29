'use client';

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { approvalRating } from "../../../lib/games";
import { gamesApi, errorMessage } from "../../../lib/api";

const TABS = [
  { sort: "players", label: "Popular" },
  { sort: "updated", label: "Recently Updated" },
  { sort: "featured", label: "Featured" },
];
const PAGE_SIZE = 24;
/** Player counts come from live servers; refresh them periodically like the rest of the site. */
const REFRESH_MS = 30_000;

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("players");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await gamesApi.list({ sort, page, limit: PAGE_SIZE });
      setGames(data.games);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load games."));
    } finally {
      setLoading(false);
    }
  }, [sort, page]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const selectTab = (next) => (e) => {
    e.preventDefault();
    if (next === sort) return;
    setLoading(true);
    setSort(next);
    setPage(1);
  };

  const tabs = (
    <ul className="nav nav-tabs mb-4">
      {TABS.map((t) => (
        <li className="nav-item" key={t.sort}>
          <a className={`nav-link ${sort === t.sort ? "active" : ""}`} href="#" onClick={selectTab(t.sort)}>{t.label}</a>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row">
          {/* Sidebar */}
          <aside className="col-lg-2 col-md-4 mb-4">
            <div className="card">
              <div className="card-header bg-primary bg-gradient text-white">
                Games
              </div>
              <div className="card-body">
                {loading ? (
                  <>
                    <div className="placeholder-wave mb-3"><span className="placeholder col-6"></span></div>
                    <ul className="list-unstyled">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <li className="mb-2" key={`time-${i}`}><span className="placeholder col-8"></span></li>
                      ))}
                    </ul>
                    <div className="placeholder-wave mt-3 mb-2"><span className="placeholder col-5"></span></div>
                    <ul className="list-unstyled">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <li className="mb-2" key={`genre-${i}`}><span className="placeholder col-9"></span></li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <h6 className="fw-bold">Time:</h6>
                    <ul className="list-unstyled">
                      <li><a href="#" className="text-decoration-none text-primary">Now</a></li>
                      <li><a href="#" className="text-decoration-none">Past Day</a></li>
                      <li><a href="#" className="text-decoration-none">Past Week</a></li>
                      <li><a href="#" className="text-decoration-none">All Time</a></li>
                    </ul>
                    <h6 className="fw-bold mt-3">Genres:</h6>
                    <ul className="list-unstyled">
                      <li><a href="#" className="text-decoration-none">All</a></li>
                      <li><a href="#" className="text-decoration-none">Town and City</a></li>
                      <li><a href="#" className="text-decoration-none">Fantasy</a></li>
                      <li><a href="#" className="text-decoration-none">Sci-Fi</a></li>
                      <li><a href="#" className="text-decoration-none">Adventure</a></li>
                      <li><a href="#" className="text-decoration-none">War</a></li>
                      <li><a href="#" className="text-decoration-none">Sports</a></li>
                      <li><a href="#" className="text-decoration-none">Funny</a></li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </aside>

          <div className="col-lg-10 col-md-8" aria-busy={loading}>
            {loading ? (
              <>
                {tabs}
                <div className="row g-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div className="col-lg-3 col-md-6" key={i}>
                      <div className="card h-100">
                        <div className="ratio ratio-4x3 bg-body rounded">
                          <div className="placeholder-wave w-100 h-100">
                            <span className="placeholder col-12" style={{ height: '100%', display: 'block' }}></span>
                          </div>
                        </div>
                        <div className="card-body">
                          <div className="placeholder-wave">
                            <span className="placeholder col-8"></span>
                          </div>
                          <div className="placeholder-wave mt-2">
                            <span className="placeholder col-6 me-2"></span>
                            <span className="placeholder col-4"></span>
                          </div>
                          <div className="d-flex align-items-center mt-2">
                            <span className="placeholder col-2 me-2"></span>
                            <div className="flex-grow-1 d-flex">
                              {[...Array(5)].map((_, idx) => (
                                <div key={idx} className="flex-grow-1 bg-light" style={{ height: 6, borderRadius: 2, marginRight: idx !== 4 ? 4 : 0 }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {tabs}
                {error && (
                  <div className="alert alert-danger" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                  </div>
                )}
                {!error && games.length === 0 && (
                  <div className="card">
                    <div className="card-body text-center py-5">
                      <i className="bi bi-controller text-primary d-block mb-3" style={{ fontSize: "3rem" }}></i>
                      <h5 className="mb-2">No games yet</h5>
                      <p className="text-body-secondary mb-3">Be the first to make one!</p>
                      <Link href="/create" className="btn btn-success"><i className="bi bi-plus-lg me-2"></i>Create a Game</Link>
                    </div>
                  </div>
                )}
                <div className="row g-3">
                  {games.map((game) => {
                    const rating = approvalRating(game);
                    return (
                      <div className="col-lg-3 col-md-6" key={game.id}>
                        <Link href={`/games/${game.id}`} className="text-decoration-none">
                          <div className="card h-100">
                            <img src={game.thumbnailUrl} className="card-img-top" alt={game.name} />
                            <div className="card-body">
                              <h6 className="card-title text-truncate">{game.name}</h6>
                              <p className="text-muted small mb-1">{game.playerCount} {game.playerCount === 1 ? "player" : "players"} online</p>
                              <p className="text-muted small mb-1 text-truncate">by {game.creator.displayName}</p>
                              <div className="d-flex align-items-center mt-2">
                                <span className="text-secondary d-flex align-items-center me-2"><i className="bi bi-hand-thumbs-up-fill me-1"></i></span>
                                <div className="flex-grow-1 d-flex">
                                  {[...Array(5)].map((_, idx) => {
                                    const segmentStart = idx * 20;
                                    const fill = Math.max(0, Math.min(20, rating - segmentStart));
                                    const fillPercent = (fill / 20) * 100;
                                    return (
                                      <div key={idx} className="flex-grow-1 bg-light" style={{ height: 6, borderRadius: 2, marginRight: idx !== 4 ? 4 : 0 }}>
                                        <div className="bg-secondary" style={{ width: `${fillPercent}%`, height: '100%', borderRadius: 2 }}></div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <nav className="mt-4" aria-label="Games pages">
                    <ul className="pagination justify-content-center">
                      <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</button>
                      </li>
                      <li className="page-item disabled"><span className="page-link">Page {page} of {totalPages}</span></li>
                      <li className={`page-item ${page >= totalPages ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next</button>
                      </li>
                    </ul>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
