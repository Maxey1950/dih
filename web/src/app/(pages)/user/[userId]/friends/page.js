'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../../contexts/AuthContext';
import { usersApi, friendsApi, errorMessage } from '../../../../../lib/api';
import UserAvatar from '../../../../../components/UserAvatar';

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('friends');
  const params = useParams();

  const { user: currentUser } = useAuth();
  const userId = params.userId;
  const isOwnProfile = !!currentUser && String(currentUser.id) === String(userId);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const profileRes = await usersApi.get(userId);
        if (cancelled) return;
        // Ownership comes from the session (GET /api/auth/me), never from a token.
        setProfile({ ...profileRes.user, isOwnProfile });

        const [friendsRes, followersRes, followingRes, requestsRes] = await Promise.allSettled([
          usersApi.friends(userId),
          usersApi.followers(userId),
          usersApi.following(userId),
          isOwnProfile ? usersApi.myFriendRequests() : Promise.resolve({ requests: [] }),
        ]);
        if (cancelled) return;
        setFriends(friendsRes.status === 'fulfilled' ? friendsRes.value?.users ?? [] : []);
        setFollowers(followersRes.status === 'fulfilled' ? followersRes.value?.users ?? [] : []);
        setFollowing(followingRes.status === 'fulfilled' ? followingRes.value?.users ?? [] : []);
        setFriendRequests(requestsRes.status === 'fulfilled' ? requestsRes.value?.requests ?? [] : []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to fetch data'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [userId, isOwnProfile]);

  // Requests are identified by the requesting user's id.
  const acceptRequest = async (requesterId) => {
    try {
      await friendsApi.accept(requesterId);
      setFriendRequests((prev) => prev.filter((req) => req.user.id !== requesterId));
      const friendsRes = await usersApi.friends(userId);
      setFriends(friendsRes?.users ?? []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to accept friend request'));
    }
  };

  const declineRequest = async (requesterId) => {
    try {
      await friendsApi.remove(requesterId);
      setFriendRequests((prev) => prev.filter((req) => req.user.id !== requesterId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to decline friend request'));
    }
  };

  const handleUnfollow = async (targetId) => {
    try {
      await usersApi.unfollow(targetId);
      setFollowing((prev) => prev.filter((u) => u.id !== targetId));
    } catch (err) {
      setError(errorMessage(err, 'Failed to unfollow user'));
    }
  };

  const UserCard = ({ user, type }) => (
    <div className="col-xl-3 col-lg-4 col-md-6">
      <div className="card h-100 border-0 shadow-sm hover-shadow transition">
        <div className="card-body text-center p-4">
          <Link href={`/user/${user.id}/profile`}>
            <UserAvatar userId={user.id} alt={user.username} className="rounded-circle mb-3" style={{ width: '100px', height: '100px', backgroundColor: 'var(--bs-secondary-bg)' }} />
          </Link>
          <h5 className="card-title mb-1">
            <Link href={`/user/${user.id}/profile`} className="text-decoration-none">{user.username}</Link>
          </h5>
          <p className="mb-3">
            <span className={`badge bg-${user.isOnline ? 'success' : 'danger'}`}>
              <i className="bi bi-circle-fill me-1"></i>
              {user.isOnline ? 'Online' : 'Offline'}
            </span>
          </p>
          <div className="d-flex gap-2 justify-content-center">
            {type === 'request' ? (
              <>
                <button className="btn btn-success btn-sm" onClick={() => acceptRequest(user.id)}>
                  <i className="bi bi-check-lg me-2"></i>
                  Accept
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => declineRequest(user.id)}>
                  <i className="bi bi-x-lg me-2"></i>
                  Reject
                </button>
              </>
            ) : (
              <>
                <Link href={`/user/${user.id}/profile`} className="btn btn-outline-primary btn-sm">
                  <i className="bi bi-person-badge me-2"></i>
                  View Profile
                </Link>
                {type === 'following' && (
                  <div className="dropdown">
                    <button className="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                      <i className="bi bi-three-dots"></i>
                    </button>
                    <ul className="dropdown-menu">
                      <li>
                        <button className="dropdown-item text-danger" onClick={() => handleUnfollow(user.id)}>
                          <i className="bi bi-person-dash me-2"></i>
                          Unfollow
                        </button>
                      </li>
                      <li>
                        <Link href={`/compose/message/${user.id}`} className="dropdown-item">
                          <i className="bi bi-chat-dots me-2"></i>
                          Message
                        </Link>
                      </li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFriends = () => (
    <>
      <div className="row align-items-center mb-4">
        <div className="col">
          <h4 className="mb-0">
            {friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}
          </h4>
          <p className="text-body-secondary mb-0">
            {friends.filter(f => f.isOnline).length} Online
          </p>
        </div>
        {profile?.isOwnProfile && (
          <div className="col-auto">
            <Link href="/users" className="btn btn-primary">
              <i className="bi bi-person-plus-fill me-2"></i>
              Find Friends
            </Link>
          </div>
        )}
      </div>

      {friends.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-people text-body-secondary fs-1"></i>
          <p className="text-body-secondary mt-2">No friends yet</p>
          {profile?.isOwnProfile && (
            <Link href="/users" className="btn btn-primary btn-sm">
              <i className="bi bi-search me-2"></i>Find Friends
            </Link>
          )}
        </div>
      ) : (
        <div className="row g-4">
          {friends.map((friend) => (
            <UserCard key={friend.id} user={friend} type="friend" />
          ))}
        </div>
      )}
    </>
  );

  const renderFriendRequests = () => (
    <>
      <div className="row align-items-center mb-4">
        <div className="col">
          <h4 className="mb-0">{friendRequests.length} Friend {friendRequests.length === 1 ? 'Request' : 'Requests'}</h4>
        </div>
      </div>
  
      {friendRequests.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-envelope text-body-secondary fs-1"></i>
          <p className="text-body-secondary mt-2">No friend requests</p>
        </div>
      ) : (
        <div className="row g-4">{friendRequests.map((request) => (<UserCard key={request.user.id} user={request.user} type="request" />))}
        </div>
      )}
    </>
  );

  const renderFollowers = () => (
    <>
      <div className="row align-items-center mb-4">
        <div className="col">
          <h4 className="mb-0">
            {followers.length} {followers.length === 1 ? 'Follower' : 'Followers'}
          </h4>
          <p className="text-body-secondary mb-0">
            {followers.filter(f => f.isOnline).length} Online
          </p>
        </div>
      </div>

      {followers.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-people text-body-secondary fs-1"></i>
          <p className="text-body-secondary mt-2">No followers yet</p>
        </div>
      ) : (
        <div className="row g-4">
          {followers.map((follower) => (<UserCard key={follower.id} user={follower} type="follower" />))}
        </div>
      )}
    </>
  );

  const renderFollowing = () => (
    <>
      <div className="row align-items-center mb-4">
        <div className="col">
          <h4 className="mb-0">
            Following {following.length} {following.length === 1 ? 'User' : 'Users'}
          </h4>
          <p className="text-body-secondary mb-0">
            {following.filter(f => f.isOnline).length} Online
          </p>
        </div>
      </div>

      {following.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-people text-body-secondary fs-1"></i>
          <p className="text-body-secondary mt-2">Not following anyone yet</p>
        </div>
      ) : (
        <div className="row g-4">
          {following.map((follow) => (<UserCard key={follow.id} user={follow} type="following" />))}
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="container-fluid py-5 bg-body-tertiary">
        <div className="container">
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">My Connections</h5>
              </div>
              <ul className="nav nav-tabs card-header-tabs mt-3 nav-fill">
                <li className="nav-item">
                  <button className="nav-link text-white d-flex align-items-center justify-content-center py-3" disabled>
                    <i className="bi bi-people-fill me-2"></i>
                    Friends
                  </button>
                </li>
                <li className="nav-item">
                  <button className="nav-link text-white d-flex align-items-center justify-content-center py-3" disabled>
                    <i className="bi bi-envelope-fill me-2"></i>
                    Requests
                  </button>
                </li>
                <li className="nav-item">
                  <button className="nav-link text-white d-flex align-items-center justify-content-center py-3" disabled>
                    <i className="bi bi-person-hearts me-2"></i>
                    Followers
                  </button>
                </li>
                <li className="nav-item">
                  <button className="nav-link text-white d-flex align-items-center justify-content-center py-3" disabled>
                    <i className="bi bi-person-heart me-2"></i>
                    Following
                  </button>
                </li>
              </ul>
            </div>
            <div className="card-body p-4 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                {profile?.isOwnProfile ? 'My Connections' : `${profile?.username}'s Connections`}
              </h5>
              <span className="badge bg-light text-primary">
                {activeTab === 'friends' ? friends.length : 
                 activeTab === 'requests' && profile?.isOwnProfile ? friendRequests.length : 
                 activeTab === 'followers' ? followers.length : following.length}
              </span>
            </div>
            <ul className="nav nav-tabs card-header-tabs mt-3 nav-fill">
              <li className="nav-item">
                <button 
                  className={`nav-link w-100 ${activeTab === 'friends' ? 'active bg-body text-body fw-bold' : 'text-white'} d-flex align-items-center justify-content-center py-3`} 
                  onClick={() => setActiveTab('friends')}
                >
                  <i className="bi bi-people-fill me-2"></i>
                  Friends
                </button>
              </li>
              {profile?.isOwnProfile && (
                <li className="nav-item">
                  <button 
                    className={`nav-link w-100 ${activeTab === 'requests' ? 'active bg-body text-body fw-bold' : 'text-white'} d-flex align-items-center justify-content-center py-3`} 
                    onClick={() => setActiveTab('requests')}
                  >
                    <i className="bi bi-envelope-fill me-2"></i>
                    Requests {friendRequests.length > 0 && (
                      <span className="badge bg-danger ms-2">{friendRequests.length}</span>
                    )}
                  </button>
                </li>
              )}
              <li className="nav-item">
                <button 
                  className={`nav-link w-100 ${activeTab === 'followers' ? 'active bg-body text-body fw-bold' : 'text-white'} d-flex align-items-center justify-content-center py-3`} 
                  onClick={() => setActiveTab('followers')}
                >
                  <i className="bi bi-person-hearts me-2"></i>
                  Followers
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link w-100 ${activeTab === 'following' ? 'active bg-body text-body fw-bold' : 'text-white'} d-flex align-items-center justify-content-center py-3`} 
                  onClick={() => setActiveTab('following')}
                >
                  <i className="bi bi-person-heart me-2"></i>
                  Following
                </button>
              </li>
            </ul>
          </div>
          <div className="card-body p-4">
            {activeTab === 'friends' && renderFriends()}
            {activeTab === 'requests' && profile?.isOwnProfile && renderFriendRequests()}
            {activeTab === 'followers' && renderFollowers()}
            {activeTab === 'following' && renderFollowing()}
          </div>
        </div>
      </div>
    </div>
  );
}