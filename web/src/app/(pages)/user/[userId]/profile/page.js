'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '../../../../../contexts/AuthContext';
import { usersApi, friendsApi, errorMessage } from '../../../../../lib/api';
import { listGamesByCreator } from '../../../../../lib/games';
import UserAvatar from '../../../../../components/UserAvatar';

/**
 * Expected GET /api/users/:id response (see shared/src/schemas.ts):
 * {
 *   user: { id, username, displayName, description, role, isOnline, lastOnlineAt, createdAt },
 *   stats: { friendCount, followerCount, followingCount },
 *   relationship: { friendship: { status: 'none'|'pending'|'accepted', direction: 'incoming'|'outgoing'|null },
 *                   isFollowing }   // null when logged out or viewing your own profile
 * }
 */
export default function UserProfile() {
  const params = useParams();
  const { user: currentUser, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blurb, setBlurb] = useState('');
  const [tempBlurb, setTempBlurb] = useState('');
  const [isEditingBlurb, setIsEditingBlurb] = useState(false);

  const [friends, setFriends] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [friendStatus, setFriendStatus] = useState(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [ownerGames, setOwnerGames] = useState([]);

  const AVATAR_ITEMS = [
    '/images/Man_Head.png',
    '/images/Man_Torso.png',
    '/images/Man_Left_Arm.png',
    '/images/Man_Right_Arm.png',
    '/images/Man_Left_Leg.png',
    '/images/Man_Right_Leg.png',
    '/images/green_jeans.png',
    '/images/motorcycle_shirt.png',
    '/images/pal_hair.png',
    '/images/Smile.png',
  ];
  const [avatarPage, setAvatarPage] = useState(0);
  const itemsPerPage = 8;
  const avatarTotalPages = Math.max(1, Math.ceil(AVATAR_ITEMS.length / itemsPerPage));
  const visibleAvatarItems = useMemo(() => {
    const start = avatarPage * itemsPerPage;
    return AVATAR_ITEMS.slice(start, start + itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarPage]);

  const userId = params.userId;

  const loadProfile = useCallback(async () => {
    const data = await usersApi.get(userId);
    const u = data?.user;
    if (!u) throw new Error('User not found');
    setProfile({
      ...u,
      // Ownership comes from the session (GET /api/auth/me), never from a token.
      isOwnProfile: !!currentUser && String(currentUser.id) === String(u.id),
    });
    setBlurb(u.description ?? '');
    setFriendCount(data?.stats?.friendCount ?? 0);
    setFollowersCount(data?.stats?.followerCount ?? 0);
    setFollowingCount(data?.stats?.followingCount ?? 0);
    setFriendStatus(data?.relationship?.friendship ?? { status: 'none' });
    setIsFollowing(!!data?.relationship?.isFollowing);
  }, [userId, currentUser]);

  const loadFriends = useCallback(async () => {
    try {
      const data = await usersApi.friends(userId);
      setFriends(data?.users ?? []);
    } catch {
      setFriends([]);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadProfile();
        await loadFriends();
        const games = await listGamesByCreator(userId);
        if (!cancelled) setOwnerGames(games);
      } catch (err) {
        if (!cancelled) setError(err?.status === 404 ? 'This user could not be found.' : errorMessage(err, 'Failed to fetch profile'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Refresh friends' online status every 30 seconds.
    const intervalId = setInterval(loadFriends, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userId, loadProfile, loadFriends]);

  const handleFollowAction = async () => {
    try {
      if (isFollowing) {
        await usersApi.unfollow(userId);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await usersApi.follow(userId);
        setFollowersCount((c) => c + 1);
      }
      setIsFollowing(!isFollowing);
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err, 'Error performing follow action'));
    }
  };

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
      await usersApi.updateMe({ description: tempBlurb });
      setBlurb(tempBlurb);
      setIsEditingBlurb(false);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to update blurb'));
    }
  };

  const handleCancelEdit = () => {
    setIsEditingBlurb(false);
    setTempBlurb('');
    setError('');
  };

  const renderFriends = () => {
    if (friends.length === 0) {
      return (
        <div className="text-center py-5">
          <i className="bi bi-people opacity-50 fs-1"></i>
          <p className="opacity-50 mt-2">No friends yet</p>
          {profile?.isOwnProfile && (
            <Link href="/users" className="btn btn-primary btn-sm">
              <i className="bi bi-search me-2"></i>Find Friends
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="row g-3">
        {friends.map((friend) => (
          <div key={friend.id} className="col-md-3 col-sm-4 col-6">
            <div className="text-center">
              <Link href={`/user/${friend.id}/profile`}>
                <UserAvatar
                  userId={friend.id}
                  alt={friend.username}
                  className="rounded-circle mb-2"
                  style={{ width: '64px', height: '64px' }}
                />
              </Link>
              <div className="small">
                <Link href={`/user/${friend.id}/profile`} className="text-decoration-none">
                  <span className={`friend-status text-${friend.isOnline ? 'success' : 'danger'} me-1`}>
                    <i className="bi bi-circle-fill"></i>
                  </span>
                  {friend.username}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // One explicit function per action; no URL is built from an action name.
  const sendFriendRequest = async () => {
    try {
      await friendsApi.sendRequest(userId);
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err, 'Error sending friend request'));
    }
  };

  const acceptFriendRequest = async () => {
    try {
      await friendsApi.accept(userId);
      await Promise.all([loadProfile(), loadFriends()]);
    } catch (err) {
      setError(errorMessage(err, 'Error accepting friend request'));
    }
  };

  const declineFriendRequest = async () => {
    try {
      await friendsApi.remove(userId);
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err, 'Error declining friend request'));
    }
  };

  const unfriend = async () => {
    try {
      await friendsApi.remove(userId);
      await Promise.all([loadProfile(), loadFriends()]);
    } catch (err) {
      setError(errorMessage(err, 'Error removing friend'));
    }
  };

  const renderFriendButton = () => {
    if (profile.isOwnProfile) {
      return null;
    }

    if (!friendStatus) return null;

    switch (friendStatus.status) {
      case 'none':
        return (
          <button className="btn btn-primary" onClick={sendFriendRequest}>
            <i className="bi bi-person-plus-fill me-2"></i>
            Add Friend
          </button>
        );
      case 'pending':
        return friendStatus.direction !== 'incoming' ? (
          <button className="btn btn-secondary" disabled>
            <i className="bi bi-clock me-2"></i>
            Request Pending
          </button>
        ) : (
          <div className="d-grid gap-2">
            <button className="btn btn-success" onClick={acceptFriendRequest}>
              <i className="bi bi-check-lg me-2"></i>
              Accept Request
            </button>
            <button className="btn btn-danger" onClick={declineFriendRequest}>
              <i className="bi bi-x-lg me-2"></i>
              Decline Request
            </button>
          </div>
        );
      case 'accepted':
        return (
          <button className="btn btn-danger" onClick={unfriend}>
            <i className="bi bi-person-dash-fill me-2"></i>
            Unfriend
          </button>
        );
      default:
        return null;
    }
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

  if (!profile) return (
    <div className="container mt-5">
      <div className="alert alert-warning shadow-sm">
        <i className="bi bi-person-x-fill me-2"></i>
        {error}
      </div>
    </div>
  );

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        {/* Header Section */}
        <div className="card shadow-sm mb-4 border-0">
          <div className="card-header bg-primary bg-gradient text-white">
            <h5 className="mb-0">{profile.username}'s Profile</h5>
          </div>
          <div className="card-body p-4">
            <div className="row align-items-center">
              <div className="col-auto">
                <UserAvatar userId={profile.id} alt={profile.username} className="rounded-circle border border-3 border-primary" style={{ width: '150px', height: '150px' }} />
              </div>
              <div className="col">
                <div className="d-flex flex-column h-100">
                  <div>
                    <h2 className="mb-1">{profile.displayName}</h2>
                    {profile.displayName !== profile.username && (
                      <div className="text-body-secondary mb-1">@{profile.username}</div>
                    )}
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="badge bg-primary">{profile.role === 'admin' ? 'Administrator' : profile.role === 'moderator' ? 'Moderator' : 'Member'}</span>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="row g-3 mt-auto">
                    <div className="col-auto">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-people-fill text-primary fs-4 me-2"></i>
                        <div>
                          <div className="small opacity-75">Friends</div>
                          <strong>{friendCount}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="col-auto">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-person-hearts text-primary fs-4 me-2"></i>
                        <div>
                          <div className="small opacity-75">Followers</div>
                          <strong>{followersCount}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="col-auto">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-person-heart text-primary fs-4 me-2"></i>
                        <div>
                          <div className="small opacity-75">Following</div>
                          <strong>{followingCount}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {profile && !profile.isOwnProfile ? (
                      <div className="col-auto ms-auto">
                        {isAuthenticated ? (
                          <div className="d-flex gap-2">
                            <Link href={`/reportabuse/userprofile/${params.userId}`}>
                              <button className="btn btn-danger">
                                <i className="bi bi-flag-fill me-2"></i>
                                Report User
                              </button>
                            </Link>
                            {renderFriendButton()}
                            <Link href={`/compose/message/${profile.id}`}>
                              <button className="btn btn-outline-primary">
                                <i className="bi bi-chat-dots-fill me-2"></i>
                                Message
                              </button>
                            </Link>
                            <div className="dropdown">
                              <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                <i className="bi bi-three-dots"></i>
                              </button>
                              <ul className="dropdown-menu">
                                <li>
                                  <button className="dropdown-item" onClick={handleFollowAction}>
                                    {isFollowing ? (
                                      <><i className="bi bi-person-dash me-2"></i>Unfollow</>
                                    ) : (
                                      <><i className="bi bi-person-plus me-2"></i>Follow</>
                                    )}
                                  </button>
                                </li>
                                <li>
                                  <Link href={`/compose/message/${profile.id}`} className="dropdown-item">
                                    <i className="bi bi-chat-dots me-2"></i>Message
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <Link href="/login" className="btn btn-primary">
                            <i className="bi bi-box-arrow-in-right me-2"></i>
                            Login to Interact
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          {/* Left Column */}
          <div className="col-md-5">
            {/* About Section */}
            <div className="card shadow-sm mb-4 border-0">
              <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">About</h5>
                {profile.isOwnProfile && (
                  <button className="btn btn-light btn-sm" onClick={handleEditBlurb}>
                    <i className="bi bi-pencil me-1"></i>
                    Edit Blurb
                  </button>
                )}
              </div>
              <div className="card-body">
              {error && (
              <div className="alert alert-danger rounded-3 d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-exclamation-circle-fill"></i>
                {error}
              </div>
            )}                {isEditingBlurb ? (
                  <div>
                    <textarea className="form-control mb-2" value={tempBlurb} onChange={(e) => setTempBlurb(e.target.value)} rows="3" maxLength="500" placeholder="What's on your mind?" />
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-success" onClick={handleSaveBlurb}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                    </div>
                    <small className="opacity-75 mt-2 d-block">{500 - tempBlurb.length} characters remaining</small>
                  </div>
                ) : (
                  <div>
                    <p className="card-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {blurb || "This user hasn't written anything yet."}
                    </p>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3" style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <i className="bi bi-calendar3 text-primary"></i>
                          </div>
                          <div>
                            <h6 className="mb-1 text-body-secondary">Joined</h6>
                            <p className="mb-0 fw-medium">{new Date(profile.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3" style={{ width: "60px", height: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <i className="bi bi-clock-history text-primary"></i>
                          </div>
                          <div>
                            <h6 className="mb-1 text-body-secondary">Last Online</h6>
                            <p className="mb-0 fw-medium">
                              {profile.isOnline ? "Online now" : profile.lastOnlineAt ? new Date(profile.lastOnlineAt).toLocaleDateString() : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Social Links */}
            <div className="card shadow-sm mb-4 border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">Social Links</h5>
              </div>
              <div className="card-body">
                <div className="d-grid gap-2">
                  <a href="#" className="btn btn-outline-primary">
                    <i className="bi bi-twitter me-2"></i>Twitter
                  </a>
                  <a href="#" className="btn btn-outline-danger">
                    <i className="bi bi-youtube me-2"></i>YouTube
                  </a>
                </div>
              </div>
            </div>
          </div>


          {/* Right Column */}
          <div className="col-md-7">

            {/* Currently Wearing */}
            <div className="card shadow-sm mb-4 border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">Currently Wearing</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 position-relative rounded d-flex align-items-center justify-content-center" style={{ minHeight: 220 }}>
                  
                    <img src="/images/noFilter.png" alt="3D Avatar" className="img-fluid" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="col-md-6 d-flex flex-column rounded">
                    <div className="flex-grow-1 d-flex align-items-center justify-content-start" style={{ minHeight: 220 }}>
                      <div className="row g-2 w-100">
                        {Array.from({ length: itemsPerPage }).map((_, i) => {
                          const src = visibleAvatarItems[i];
                          return (
                            <div key={`slot-${i}`} className="col-3">
                              <div className="rounded-3 bg-secondary bg-gradient d-flex align-items-center justify-content-center" style={{ height: 80, visibility: src ? 'visible' : 'hidden' }}>
                                {src && (
                                  <img src={src} alt={`Avatar Item ${i + 1 + avatarPage * itemsPerPage}`} className="img-fluid" style={{ maxHeight: 72 }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="d-flex justify-content-center mt-3">
                      {Array.from({ length: avatarTotalPages }).map((_, i) => (
                        <button
                          key={`dot-${i}`}
                          type="button"
                          className={`btn p-0 mx-1 ${i === avatarPage ? 'bg-primary' : 'bg-secondary-subtle'}`}
                          style={{ width: 10, height: 10, borderRadius: '50%' }}
                          onClick={() => setAvatarPage(i)}
                          aria-label={`Page ${i + 1}`}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 mb-4">
            <div className="row g-4">
              <div className="col-md-5">
                <div className="card shadow-sm border-0">
                  <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Friends</h5>
                    <Link href={`/user/${params.userId}/friends`} className="text-white text-decoration-none">
                      See All <i className="bi bi-arrow-right"></i>
                    </Link>
                  </div>
                  <div className="card-body">
                    {renderFriends()}
                  </div>
                </div>
              </div>
              <div className="col-md-7">
                <div className="card shadow-sm border-0">
                  <div className="card-header bg-primary bg-gradient text-white">
                    <h5 className="mb-0">Places</h5>
                  </div>
                  <div className="card-body">
                    {ownerGames.length === 0 ? (
                      <p className="mb-0">This user does not have active places.</p>
                    ) : (
                      <div className="accordion" id="placesAccordion">
                        {ownerGames.map((g) => (
                          <div className="accordion-item" key={g.id}>
                            <h2 className="accordion-header">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#place-${g.id}`} aria-expanded="false" aria-controls={`place-${g.id}`}>
                                <span className="small fw-bold text-truncate me-2">{g.name}</span>
                              </button>
                            </h2>
                            <div id={`place-${g.id}`} className="accordion-collapse collapse" data-bs-parent="#placesAccordion">
                              <div className="accordion-body">
                                <div className="mx-auto" style={{ maxWidth: '480px' }}>
                                  <div className="ratio ratio-16x9 bg-body mb-2">
                                    <img src={g.thumbnailUrl} alt={g.name} className="w-100 h-100 object-fit-cover" />
                                  </div>
                                  <Link href={`/games/${g.id}`} className="btn btn-success btn-sm rounded d-inline-flex align-items-center justify-content-center px-4" style={{ minWidth: '220px' }}>
                                   Play
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full Width Stats Section */}
          <div className="col-12 mb-4">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">Statistics</h5>
              </div>
              <div className="card-body">
                <div className="row g-4">
                  <div className="col-md-6 d-flex justify-content-center">
                    <div className="d-flex align-items-center">
                      <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3" style={{ width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="bi bi-calendar3 text-primary fs-4"></i>
                      </div>
                      <div>
                        <h6 className="mb-1 opacity-75">Join Date</h6>
                        <h4 className="mb-0">{new Date(profile.createdAt).toLocaleDateString()}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex justify-content-center">
                    <div className="d-flex align-items-center">
                      <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3" style={{ width: "80px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="bi bi-trophy-fill text-primary fs-4"></i>
                      </div>
                      <div>
                        <h6 className="mb-1 opacity-75">Place Visits</h6>
                        <h4 className="mb-0">25</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}