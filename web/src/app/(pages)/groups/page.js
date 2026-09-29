'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { groupsApi, errorMessage } from '../../../lib/api';

export default function GroupsDiscoveryPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('memberCount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  /** Expected GET /api/groups response: { groups: [{ id, name, description, memberCount, isPublic, owner: { id, username } }] } */
  const fetchGroups = async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data?.groups ?? []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch groups'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchInput);
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        {/* Search Header */}
        <div className="card bg-primary bg-gradient shadow-sm border-0 mb-4">
          <div className="card-body p-3">
            <form onSubmit={handleSearch} className="row g-2 align-items-center">
              <div className="col-auto">
                <label className="col-form-label fw-semibold text-white">Search:</label>
              </div>
              <div className="col">
                <input
                  type="text"
                  className="form-control"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="col-auto">
                <button type="submit" className="btn btn-light">
                  Search Groups
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Groups List */}
        <div className="card shadow-sm border-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr className="table-primary text-white">
                  <th className="border-0 py-3 ps-4" style={{ width: '40%' }}>Group</th>
                  <th className="border-0 py-3">Description</th>
                  <th className="border-0 py-3 text-center" style={{ width: '100px' }}>Members</th>
                  <th className="border-0 py-3 text-center" style={{ width: '100px' }}>Public</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5">
                      <div className="d-flex flex-column align-items-center gap-2">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <div className="text-body-secondary">
                          Loading groups...
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4">
                      <div className="text-danger">
                        <i className="bi bi-exclamation-circle me-2"></i>
                        {error}
                      </div>
                    </td>
                  </tr>
                ) : (
                  groups
                    .filter(group => group.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((group) => (
                      <tr key={group.id}>
                        <td className="py-3 ps-4">
                          <div className="d-flex align-items-center">
                            <div className="flex-shrink-0">
                              <div className="rounded bg-primary bg-opacity-10 p-2" style={{ width: '40px', height: '40px' }}>
                                <i className="bi bi-people-fill text-primary"></i>
                              </div>
                            </div>
                            <div className="ms-3">
                              <Link 
                                href={`/groups/group/${group.id}`}
                                className="text-decoration-none"
                              >
                                <h6 className="mb-0">{group.name}</h6>
                              </Link>
                              {group.tags && group.tags.length > 0 && (
                                <div className="mt-1">
                                  {group.tags.map((tag, index) => (
                                    <span key={index} className="badge bg-primary-subtle text-primary me-1">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="text-body-secondary small">
                            {group.description}
                            {group.announcements && group.announcements.map((announcement, index) => (
                              <div key={index} className="mt-1">
                                <i className="bi bi-megaphone me-1"></i>
                                {announcement}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className="badge bg-primary-subtle text-primary">
                            {group.memberCount.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {group.isPublic ? (
                            <span className="badge bg-success-subtle text-success">Yes</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger">No</span>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}