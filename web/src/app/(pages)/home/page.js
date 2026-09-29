'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import RequireAuth from '../../../components/auth/RequireAuth';
import UserAvatar from '../../../components/UserAvatar';
import { useAuth } from '../../../contexts/AuthContext';
import { usersApi, errorMessage } from '../../../lib/api';
import { siteConfig } from '../../../../config/site';

const SOCIAL_CARDS = [
  { key: 'discord', title: 'Discord', text: 'Join our community', cta: 'Join Server', icon: 'bi-discord', iconColor: 'text-info', bubble: 'bg-primary', button: 'btn-info' },
  { key: 'youtube', title: 'YouTube', text: 'Subscribe to us', cta: 'Subscribe', icon: 'bi-youtube', iconColor: 'text-danger', bubble: 'bg-danger', button: 'btn-danger' },
  { key: 'twitter', title: 'Twitter', text: 'Follow us', cta: 'Follow', icon: 'bi-twitter', iconColor: 'text-primary', bubble: 'bg-info', button: 'btn-primary text-white' },
  { key: 'github', title: 'GitHub', text: 'See our code', cta: 'View', icon: 'bi-github', iconColor: 'text-body', bubble: 'bg-secondary', button: 'btn-secondary' },
];

function HomePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blurb, setBlurb] = useState('');
  const [isEditingBlurb, setIsEditingBlurb] = useState(false);
  const [tempBlurb, setTempBlurb] = useState('');
  const [error, setError] = useState('');
  const [friends, setFriends] = useState([]);

  const username = user?.username ?? '';
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Profile and friends endpoints arrive in a later phase; show empty state until then.
      const [profile, friendList] = await Promise.allSettled([usersApi.get(userId), usersApi.friends(userId)]);
      if (cancelled) return;
      if (profile.status === 'fulfilled') setBlurb(profile.value?.user?.blurb ?? '');
      if (friendList.status === 'fulfilled') setFriends(friendList.value?.friends ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleEditBlurb = () => {
    setTempBlurb(blurb);
    setIsEditingBlurb(true);
    setError('');
  };

  const handleSaveBlurb = async () => {
    try {
      if (tempBlurb.length > 500) {
        setError('Blurb must be less than 500 characters');
        return;
      }
      await usersApi.updateMe({ blurb: tempBlurb });
      setBlurb(tempBlurb);
      setIsEditingBlurb(false);
      setError('');
    } catch (error) {
      setError(errorMessage(error, 'Failed to update blurb'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditingBlurb(false);
    setTempBlurb('');
    setError('');
  };

  // Replace the friends section with this updated version
  const renderFriends = () => {
    if (friends.length === 0) {
      return (
        <div className="text-center py-4">
          <div className="mb-3">
            <i className="bi bi-people text-primary opacity-75" style={{ fontSize: '3rem' }}></i>
          </div>
          <h6 className="text-body-secondary mb-3">No friends yet</h6>
          <Link href="/users" className="btn btn-primary btn-sm">
            <i className="bi bi-search me-2"></i>
            Find Friends
          </Link>
        </div>
      );
    }

    return (
      <div className="row">
        {friends.map((friend) => (
          <div key={friend.id} className="col-12 col-sm-6 col-md-4 col-lg-3 text-center friend-item">
            <Link href={`/user/${friend.id}/profile`} title={friend.username}>
              <UserAvatar
                userId={friend.id}
                alt={friend.username}
                className="rounded-circle"
                style={{width: '100px', height: '100px', backgroundColor: '#f5f5f5'}}
              />
            </Link>
            <p className="mt-2">
              <Link href={`/user/${friend.id}/profile`} className="text-decoration-none" title={friend.username}>
                <span className={`friend-status text-${friend.isOnline ? 'success' : 'danger'} me-1`}>
                  <i className="bi bi-circle-fill"></i>
                </span>
                {friend.username}
              </Link>
            </p>
          </div>
        ))}
      </div>
    );
  };


  if (loading) {
    return (
      <div className="container min-vh-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row g-4 justify-content-center">
        
            {/* Welcome Section */}
            <div className="col-md-6">
              <div className="d-flex justify-content-center">
                <div className="card w-100 border-0 shadow-sm">
                  <div className="card-header bg-primary bg-gradient text-white">
                    <h5 className="mb-0">Welcome, {username}</h5>
                  </div>
                  <div className="card-body text-center">
                    <UserAvatar
                      userId={userId}
                      alt="User Avatar"
                      className="img-fluid"
                      style={{maxWidth: '250px'}}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="col-md-6">
              <div className="d-flex justify-content-center mb-4">
                <div className="card w-100 border-0 shadow-sm">
                  <div className="card-header bg-primary bg-gradient text-white">
                    <h5 className="mb-0">Current Status</h5>
                  </div>
                  <div className="card-body">
                    <strong>Right now I&apos;m:</strong>
                      {isEditingBlurb ? (
                        <div>
                          <textarea className="form-control mb-2" value={tempBlurb} onChange={(e) => setTempBlurb(e.target.value)} rows="3" maxLength="500" placeholder="What's on your mind?" />
                          {error && <div className="alert alert-danger">{error}</div>}
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-success" onClick={handleSaveBlurb}>Save</button>
                            <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                          </div>
                          <small className="text-body-secondary mt-2 d-block">{500 - tempBlurb.length} characters remaining</small>
                        </div>
                      ) : (
                        <div>
                          <p className="mb-3">{blurb || "No status set yet..."}</p>
                          <button className="btn btn-sm btn-secondary" onClick={handleEditBlurb}>
                            <i className="bi bi-pencil me-1"></i>
                            Edit Blurb
                          </button>
                        </div>
                        )}
                    </div>
                  </div>
                </div>

              {/* Friends Section */}
              <div className="d-flex justify-content-center">
                <div className="card w-100 border-0 shadow-sm">
                  <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Friends</h5>
                    <span className="badge bg-light text-primary">{friends.length}</span>
                  </div>
                  <div className="card-body">
                    {renderFriends()}
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Links - Full Width (shown only when links are configured) */}
            {SOCIAL_CARDS.some((c) => siteConfig.social[c.key]) && (
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-primary bg-gradient text-white">
                  <h5 className="mb-0">Connect With Us</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {SOCIAL_CARDS.filter((c) => siteConfig.social[c.key]).map((c) => (
                    <div key={c.key} className="col-sm-6 col-lg-3">
                      <div className="card h-100 border-0 bg-body-tertiary hover-shadow transition">
                        <div className="card-body text-center p-3">
                          <div className={`d-inline-block ${c.bubble} bg-opacity-10 p-3 rounded-circle mb-3`} style={{width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                            <i className={`bi ${c.icon} fs-2 ${c.iconColor}`}></i>
                          </div>
                          <h6 className="card-title">{c.title}</h6>
                          <p className="card-text small text-body-secondary">{c.text}</p>
                          <a href={siteConfig.social[c.key]} target="_blank" rel="noopener noreferrer" className={`btn ${c.button} btn-sm px-4`}>
                            {c.cta}
                          </a>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <HomePage />
    </RequireAuth>
  );
}