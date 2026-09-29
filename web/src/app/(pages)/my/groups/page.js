'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import RequireAuth from '../../../../components/auth/RequireAuth';
import { useAuth } from '../../../../contexts/AuthContext';
import { usersApi, errorMessage } from '../../../../lib/api';


function GroupsPage() {
    const { user: currentUser } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
  


    useEffect(() => {
        fetchGroups();
    }, []);

    /** Expected GET /api/users/me/groups response: { groups: [{ id, name, description, memberCount, isPublic, owner: { id, username } }] } */
    const fetchGroups = async () => {
        try {
            const data = await usersApi.myGroups();
            setGroups(data?.groups ?? []);
        } catch (err) {
            setError(errorMessage(err, 'Failed to fetch groups'));
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = groups.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
      // The server already returns only groups the current user belongs to.
      const myGroups = filteredGroups;
    
      const managedGroups = filteredGroups.filter(group => 
        currentUser && group.owner?.id === currentUser.id
      );


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
        <div className="row">
          {/* Sidebar */}
          <div className="col-lg-3 mb-4">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white p-4">
                <h5 className="mb-1">My Groups</h5>
                <p className="mb-0 text-white-50 small">Manage and explore your groups</p>
              </div>
              <div className="list-group list-group-flush">
                <button
                  className={`list-group-item list-group-item-action d-flex align-items-center ${activeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >
                  <i className="bi bi-grid-3x3-gap-fill me-3"></i>
                  All Groups
                  <span className="badge bg-primary rounded-pill ms-auto">{filteredGroups.length}</span>
                </button>
                <button
                  className={`list-group-item list-group-item-action d-flex align-items-center ${activeFilter === 'joined' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('joined')}
                >
                  <i className="bi bi-people-fill me-3"></i>
                  Joined Groups
                  <span className="badge bg-primary rounded-pill ms-auto">{myGroups.length}</span>
                </button>
                <button
                  className={`list-group-item list-group-item-action d-flex align-items-center ${activeFilter === 'managed' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('managed')}
                >
                  <i className="bi bi-gear-fill me-3"></i>
                  Managed Groups
                  <span className="badge bg-primary rounded-pill ms-auto">{managedGroups.length}</span>
                </button>
              </div>
              <div className="card-body">
                <Link href="/groups/create" className="btn btn-primary w-100">
                  <i className="bi bi-plus-circle me-2"></i>
                  Create New Group
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-lg-9">
            {/* Search and Filter Header */}
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body p-4">
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search groups..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Groups Grid */}
            <div className="row g-4">
              {(activeFilter === 'all' ? filteredGroups :
                activeFilter === 'joined' ? myGroups :
                managedGroups).map((group) => (
                <div key={group.id} className="col-md-6">
                  <div className="card h-100 shadow-sm border-0 hover-shadow transition">
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center mb-3">
                        <div className="flex-shrink-0">
                          <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                            <i className="bi bi-people-fill text-primary fs-4"></i>
                          </div>
                        </div>
                        <div className="ms-3 flex-grow-1">
                          <h5 className="card-title mb-1">
                            <Link 
                              href={`/groups/group/${group.id}`}
                              className="text-decoration-none text-body stretched-link"
                            >
                              {group.name}
                            </Link>
                          </h5>
                          <p className="text-body-secondary small mb-0">
                            Created by {group.owner?.username}
                          </p>
                        </div>
                      </div>
                      <p className="card-text text-body-secondary mb-3">
                        {group.description}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <span className="badge bg-primary-subtle text-primary">
                            <i className="bi bi-people me-1"></i>
                            {group.memberCount} members
                          </span>
                          {group.isPublic ? (
                            <span className="badge bg-success-subtle text-success">
                              <i className="bi bi-globe me-1"></i>
                              Public
                            </span>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning">
                              <i className="bi bi-lock me-1"></i>
                              Private
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyGroups() {
    return (
        <RequireAuth>
            <GroupsPage />
        </RequireAuth>
    );
}
