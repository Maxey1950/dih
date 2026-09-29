'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { approvalRating, listGames } from "../../../lib/games";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listGames().then((list) => {
      if (cancelled) return;
      setGames(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
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
                <ul className="nav nav-tabs mb-4">
                  <li className="nav-item">
                    <a className="nav-link active" href="#">Popular</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Most Favorited</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Featured</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Contest</a>
                  </li>
                </ul>
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
                <ul className="nav nav-tabs mb-4">
                  <li className="nav-item">
                    <a className="nav-link active" href="#">Popular</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Most Favorited</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Featured</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Contest</a>
                  </li>
                </ul>
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
                              <p className="text-muted small mb-1">{game.playerCount} players online</p>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
