'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { groupsApi, errorMessage } from '../../../../../lib/api';
import UserAvatar from '../../../../../components/UserAvatar';

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState(null);
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    fetchGroupDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.groupId]);

  /**
   * Expected GET /api/groups/:id response:
   * { group: { id, name, description, isPublic, memberCount, isMember,
   *            owner: { id, username }, members: [{ id, username }] } }
   */
  const fetchGroupDetails = async () => {
    try {
      const data = await groupsApi.get(params.groupId);
      setGroup(data?.group ?? null);
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch group details'));
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await groupsApi.leave(params.groupId);
      setGroup(prevGroup => ({
        ...prevGroup,
        members: prevGroup.members.filter(member => member.id !== currentUser?.id),
        memberCount: prevGroup.memberCount - 1,
        isMember: false
      }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to leave group'));
    }
  };

  const handleJoinGroup = async () => {
    try {
      await groupsApi.join(params.groupId);
      setGroup(prevGroup => ({
        ...prevGroup,
        members: [...prevGroup.members, { id: currentUser.id, username: currentUser.username }],
        memberCount: prevGroup.memberCount + 1,
        isMember: true
      }));
    } catch (err) {
      setError(errorMessage(err, 'Failed to join group'));
    }
  };

  const [groupSettings, setGroupSettings] = useState({
    name: group?.name || '',
    description: group?.description || '',
    isPublic: group?.isPublic || false
  });
  
  const [errors, setErrors] = useState({});
  
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
  
    try {
      await groupsApi.update(group.id, groupSettings);
      fetchGroupDetails();
    } catch (err) {
      if (err?.details?.field) {
        setErrors({ [err.details.field]: err.message });
      } else {
        setErrors({ general: errorMessage(err, 'Failed to update group') });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    setLoading(true);
    try {
      await groupsApi.removeMember(group.id, userId);
      fetchGroupDetails();
    } catch (err) {
      setErrors({ general: errorMessage(err, 'Failed to remove member') });
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning" role="alert">
          Group not found
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        {/* Group Header */}
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="rounded-circle bg-primary bg-opacity-10 p-4">
                  <i className="bi bi-people-fill text-primary fs-2"></i>
                </div>
              </div>
              <div className="ms-4">
                <h2 className="mb-1">{group.name}</h2>
                <p className="text-body-secondary mb-2">
                  Created by {group.owner?.username} • {group.memberCount} members
                </p>
                {currentUser && (
                  <div className="d-flex gap-2">
                    {group.owner?.id === currentUser.id ? (
                      <button className="btn btn-outline-primary btn-sm">
                        <i className="bi bi-gear-fill me-2"></i>
                        Manage Group
                      </button>
                    ) : group.isMember ? (
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleLeaveGroup}
                      >
                        <i className="bi bi-box-arrow-right me-2"></i>
                        Leave Group
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={handleJoinGroup}
                      >
                        <i className="bi bi-person-plus-fill me-2"></i>
                        Join Group
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              About
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
          </li>
          {group.owner?.id === currentUser?.id && (
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </li>
          )}
        </ul>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'about' && (
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title mb-3">About this group</h5>
                <p className="card-text">{group.description}</p>
                <div className="mt-4">
                  <h6 className="mb-3">Group Information</h6>
                  <ul className="list-unstyled">
                    <li className="mb-2">
                      <i className="bi bi-calendar3 me-2"></i>
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </li>
                    <li className="mb-2">
                      <i className="bi bi-globe me-2"></i>
                      {group.isPublic ? 'Public Group' : 'Private Group'}
                    </li>
                    <li>
                      <i className="bi bi-people me-2"></i>
                      {group.memberCount} Members
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title mb-4">Members</h5>
                <div className="row g-4">
                  {group.members?.map((member) => (
                    <div key={member.id} className="col-md-6 col-lg-4">
                      <div className="d-flex align-items-center">
                        <div className="flex-shrink-0">
                          <UserAvatar userId={member.id} alt={member.username} className="rounded-circle" size={40} />
                        </div>
                        <div className="ms-3">
                          <h6 className="mb-0">{member.username}</h6>
                          {member.id === group.owner?.id && (
                            <span className="badge bg-primary">Owner</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

{activeTab === 'settings' && (
  <div className="row">
    <div className="col-md-8">
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h5 className="card-title mb-4">Group Settings</h5>
          <form onSubmit={handleUpdateGroup}>
            <div className="mb-3">
              <label className="form-label">Group Name</label>
              <input
                type="text"
                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                value={groupSettings.name}
                onChange={(e) => setGroupSettings({
                  ...groupSettings,
                  name: e.target.value
                })}
                minLength="3"
                maxLength="50"
                required
              />
              {errors.name && (
                <div className="invalid-feedback">{errors.name}</div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea
                className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                rows="4"
                value={groupSettings.description}
                onChange={(e) => setGroupSettings({
                  ...groupSettings,
                  description: e.target.value
                })}
                minLength="10"
                maxLength="500"
                required
              ></textarea>
              {errors.description && (
                <div className="invalid-feedback">{errors.description}</div>
              )}
            </div>

            <div className="mb-4">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="isPublic"
                  checked={groupSettings.isPublic}
                  onChange={(e) => setGroupSettings({
                    ...groupSettings,
                    isPublic: e.target.checked
                  })}
                />
                <label className="form-check-label" htmlFor="isPublic">
                  Make this group public
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-save me-2"></i>
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h5 className="card-title mb-4">Manage Members</h5>
          <div className="list-group">
            {group.members.map((member) => (
              <div key={member.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <UserAvatar userId={member.id} alt={member.username} className="rounded-circle" size={40} />
                  <div className="ms-3">
                    <h6 className="mb-0">{member.username}</h6>
                    {member.id === group.owner?.id && (
                      <span className="badge bg-primary">Owner</span>
                    )}
                  </div>
                </div>
                {member.id !== group.owner?.id && (
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={loading}
                  >
                    <i className="bi bi-person-x me-2"></i>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
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