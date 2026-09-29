"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import RequireAuth from "../../../components/auth/RequireAuth";
import UserAvatar from "../../../components/UserAvatar";
import { adminApi, errorMessage } from "../../../lib/api";
import { debounce } from "../../../lib/utils/debounce";

const BAN_DURATIONS_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Admin UI shell. Access here is a UX gate only (RequireAuth role="admin");
 * every admin endpoint must enforce the admin role on the server and write an
 * audit log entry. Admin actions are not implemented by the API in Phase 1.
 *
 * Expected GET /api/admin/users?query=&page= response:
 * { users: [{ id, username, displayName, description, role, isBanned, isOnline, createdAt, lastOnlineAt }],
 *   total, totalPages }
 */
function AdminDashboardPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");
  const usersPerPage = 10;

  const fetchUsers = useCallback(async () => {
    try {
      const data = await adminApi.users({ search: query || undefined, page: currentPage });
      setUsers(data?.users ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(Math.max(1, data?.totalPages ?? 1));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch users"));
    } finally {
      setLoading(false);
    }
  }, [query, currentPage]);

  useEffect(() => {
    fetchUsers();
    const intervalId = setInterval(fetchUsers, 60000);
    return () => clearInterval(intervalId);
  }, [fetchUsers]);

  const handleSearch = useMemo(
    () =>
      debounce((value) => {
        setQuery(value.trim());
        setCurrentPage(1);
      }, 300),
    []
  );
  useEffect(() => () => handleSearch.cancel(), [handleSearch]);

  const getCurrentPageUsers = () => users;

  const flash = (setter, message) => {
    setter(message);
    setTimeout(() => setter(null), 3000);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleBanUser = (user) => {
    setSelectedUser(user);
    setShowBanModal(true);
  };

  const executeBanUser = async () => {
    if (!selectedUser) return;
    setActionLoading("Banning user...");
    try {
      const ms = BAN_DURATIONS_MS[banDuration];
      await adminApi.ban(selectedUser.id, {
        reason: banReason,
        expiresAt: ms ? new Date(Date.now() + ms).toISOString() : null,
      });
      flash(setActionSuccess, `User ${selectedUser.username} has been banned successfully`);
      setShowBanModal(false);
      setBanReason("");
      setBanDuration("permanent");
      fetchUsers();
    } catch (err) {
      flash(setActionError, errorMessage(err, "Failed to ban user"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbanUser = async (user) => {
    setActionLoading(`Unbanning ${user.username}...`);
    try {
      await adminApi.unban(user.id);
      flash(setActionSuccess, `User ${user.username} has been unbanned successfully`);
      fetchUsers();
    } catch (err) {
      flash(setActionError, errorMessage(err, "Failed to unban user"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async (user, newRole) => {
    setActionLoading(`Updating ${user.username}'s role...`);
    try {
      await adminApi.setRole(user.id, newRole);
      flash(setActionSuccess, `User ${user.username}'s role has been updated to ${newRole}`);
      fetchUsers();
    } catch (err) {
      flash(setActionError, errorMessage(err, "Failed to update user role"));
    } finally {
      setActionLoading(null);
    }
  };

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
        {/* Action Messages */}
        {actionSuccess && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {actionSuccess}
            <button type="button" className="btn-close" onClick={() => setActionSuccess(null)}></button>
          </div>
        )}
        
        {actionError && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {actionError}
            <button type="button" className="btn-close" onClick={() => setActionError(null)}></button>
          </div>
        )}
        
        {actionLoading && (
          <div className="alert alert-info" role="alert">
            <div className="d-flex align-items-center">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              {actionLoading}
            </div>
          </div>
        )}
        
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center">
              <h2 className="mb-0">Admin Dashboard</h2>
              <div>
                <Link href="/admin/reports" className="btn btn-outline-primary me-2">
                  <i className="bi bi-flag me-2"></i>
                  Reports
                </Link>
                <Link href="/admin/logs" className="btn btn-outline-secondary">
                  <i className="bi bi-journal-text me-2"></i>
                  Activity Logs
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        <div className="row">
          <div className="col-md-3 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Quick Stats</h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Total Users:</span>
                    <span className="badge bg-primary">{users.length}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Online Users:</span>
                    <span className="badge bg-success">
                      {users.filter(user => user.isOnline).length}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Banned Users:</span>
                    <span className="badge bg-danger">
                      {users.filter(user => user.isBanned).length}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Admin Users:</span>
                    <span className="badge bg-warning text-dark">
                      {users.filter(user => user.role === 'admin').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-9">
            <div className="card shadow-sm">
              <div className="card-header bg-primary bg-gradient text-white p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="mb-1">User Management</h4>
                    <p className="mb-0 text-white-50">Manage all users in the system</p>
                  </div>
                  <span className="badge bg-white text-primary fs-6">
                    {total} Users
                  </span>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-white border-0">
                    <i className="bi bi-search"></i>
                  </span>
                  <input 
                    type="text" 
                    className="form-control border-0 py-2" 
                    placeholder="Search users by username..." 
                    onChange={(e) => {
                      setSearchTerm(e.target.value); 
                      handleSearch(e.target.value);
                    }} 
                    value={searchTerm} 
                  />
                </div>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-body-secondary">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Last Online</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="6" className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        getCurrentPageUsers().map((user) => (
                          <tr key={user.id} className={user.isBanned ? 'bg-danger-subtle' : ''}>
                            <td className="px-4 py-3">
                              <div className="d-flex align-items-center">
                                <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: "48px", height: "48px", overflow: "hidden" }}>
                                  <UserAvatar userId={user.id} alt={user.username} className="w-100 h-100 object-fit-cover" />
                                </div>
                                <div>
                                  <h6 className="mb-0 text-primary">{user.username}</h6>
                                  <small className="text-body-secondary">ID: {user.id}</small>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="mb-0">{user.email || 'N/A'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="dropdown">
                                <button 
                                  className={`btn btn-sm ${user.role === 'admin' ? 'btn-warning' : user.role === 'moderator' ? 'btn-info' : 'btn-outline-secondary'}`}
                                  type="button" 
                                  id={`roleDropdown-${user.id}`} 
                                  data-bs-toggle="dropdown" 
                                  aria-expanded="false"
                                >
                                  {user.role || 'user'}
                                  <i className="bi bi-chevron-down ms-1"></i>
                                </button>
                                <ul className="dropdown-menu" aria-labelledby={`roleDropdown-${user.id}`}>
                                  <li><button className="dropdown-item" onClick={() => handleChangeRole(user, 'user')}>User</button></li>
                                  <li><button className="dropdown-item" onClick={() => handleChangeRole(user, 'moderator')}>Moderator</button></li>
                                  <li><button className="dropdown-item" onClick={() => handleChangeRole(user, 'admin')}>Admin</button></li>
                                </ul>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <small className="text-body-secondary">
                                {user.lastOnline ? new Date(user.lastOnline).toLocaleString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                }) : "N/A"}
                              </small>
                            </td>
                            <td className="px-4 py-3">
                              {user.isBanned ? (
                                <span className="badge bg-danger">
                                  <i className="bi bi-slash-circle me-1"></i>
                                  Banned
                                </span>
                              ) : (
                                <span className={`badge bg-${user.isOnline ? "success" : "secondary"}`}>
                                  <i className="bi bi-circle-fill me-1"></i>
                                  {user.isOnline ? "Online" : "Offline"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="btn-group">
                                <button 
                                  className="btn btn-sm btn-outline-primary" 
                                  onClick={() => handleViewUser(user)}
                                >
                                  <i className="bi bi-eye"></i>
                                </button>
                                <Link 
                                  href={`/user/${user.id}/profile`} 
                                  className="btn btn-sm btn-outline-secondary"
                                  target="_blank"
                                >
                                  <i className="bi bi-box-arrow-up-right"></i>
                                </Link>
                                {user.isBanned ? (
                                  <button 
                                    className="btn btn-sm btn-outline-success" 
                                    onClick={() => handleUnbanUser(user)}
                                  >
                                    <i className="bi bi-unlock"></i>
                                  </button>
                                ) : (
                                  <button 
                                    className="btn btn-sm btn-outline-danger" 
                                    onClick={() => handleBanUser(user)}
                                  >
                                    <i className="bi bi-ban"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-4 border-top">
                    <div className="text-body-secondary small">Showing {(currentPage - 1) * usersPerPage + 1} to{" "}{Math.min(currentPage * usersPerPage, total)} {" "} of {total} users</div>
                    <nav>
                        <ul className="pagination mb-0">
                            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                                <button className="page-link" onClick={() => setCurrentPage((prev) => prev - 1)} disabled={currentPage === 1}>Previous</button>
                            </li>
                            {[...Array(totalPages)].map((_, index) => (
                            <li key={index} className={`page-item ${currentPage === index + 1 ? "active" : ""}`}>
                                <button className="page-link" onClick={() => setCurrentPage(index + 1)}>{index + 1}</button>
                            </li>
                            ))}
                            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                                <button className="page-link" onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage === totalPages}>Next</button>
                            </li>
                        </ul>
                    </nav>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">User Details: {selectedUser.username}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUserModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-4 text-center mb-4 mb-md-0">
                    <div className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3" style={{ width: "120px", height: "120px", overflow: "hidden" }}>
                      <UserAvatar userId={selectedUser.id} alt={selectedUser.username} className="w-100 h-100 object-fit-cover" />
                    </div>
                    <h5 className="mb-1">{selectedUser.username}</h5>
                    <p className="text-muted">User ID: {selectedUser.id}</p>
                    <div className="d-grid gap-2">
                      <Link 
                        href={`/user/${selectedUser.id}/profile`} 
                        className="btn btn-outline-primary btn-sm"
                        target="_blank"
                      >
                        <i className="bi bi-box-arrow-up-right me-2"></i>
                        View Public Profile
                      </Link>
                    </div>
                  </div>
                  <div className="col-md-8">
                    <div className="card mb-3">
                      <div className="card-header bg-light">Account Information</div>
                      <div className="card-body">
                        <div className="row mb-2">
                          <div className="col-md-4 fw-bold">Email:</div>
                          <div className="col-md-8">{selectedUser.email || 'N/A'}</div>
                        </div>
                        <div className="row mb-2">
                          <div className="col-md-4 fw-bold">Role:</div>
                          <div className="col-md-8">
                            <span className={`badge ${selectedUser.role === 'admin' ? 'bg-warning' : selectedUser.role === 'moderator' ? 'bg-info' : 'bg-secondary'}`}>
                              {selectedUser.role || 'user'}
                            </span>
                          </div>
                        </div>
                        <div className="row mb-2">
                          <div className="col-md-4 fw-bold">Status:</div>
                          <div className="col-md-8">
                            {selectedUser.isBanned ? (
                              <span className="badge bg-danger">
                                <i className="bi bi-slash-circle me-1"></i>
                                Banned
                              </span>
                            ) : (
                              <span className={`badge bg-${selectedUser.isOnline ? "success" : "secondary"}`}>
                                <i className="bi bi-circle-fill me-1"></i>
                                {selectedUser.isOnline ? "Online" : "Offline"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="row mb-2">
                          <div className="col-md-4 fw-bold">Last Online:</div>
                          <div className="col-md-8">
                            {selectedUser.lastOnline ? new Date(selectedUser.lastOnline).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            }) : "N/A"}
                          </div>
                        </div>
                        <div className="row mb-2">
                          <div className="col-md-4 fw-bold">Join Date:</div>
                          <div className="col-md-8">
                            {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit', 
                              year: 'numeric'
                            }) : "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-header bg-light">User Actions</div>
                      <div className="card-body">
                        <div className="d-flex flex-wrap gap-2">
                          {selectedUser.isBanned ? (
                            <button 
                              className="btn btn-success btn-sm" 
                              onClick={() => {
                                handleUnbanUser(selectedUser);
                                setShowUserModal(false);
                              }}
                            >
                              <i className="bi bi-unlock me-2"></i>
                              Unban User
                            </button>
                          ) : (
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => {
                                setShowUserModal(false);
                                handleBanUser(selectedUser);
                              }}
                            >
                              <i className="bi bi-ban me-2"></i>
                              Ban User
                            </button>
                          )}
                          <div className="dropdown">
                            <button 
                              className="btn btn-primary btn-sm dropdown-toggle" 
                              type="button" 
                              id="changeRoleDropdown" 
                              data-bs-toggle="dropdown" 
                              aria-expanded="false"
                            >
                              <i className="bi bi-person-gear me-2"></i>
                              Change Role
                            </button>
                            <ul className="dropdown-menu" aria-labelledby="changeRoleDropdown">
                              <li><button className="dropdown-item" onClick={() => {
                                handleChangeRole(selectedUser, 'user');
                                setShowUserModal(false);
                              }}>User</button></li>
                              <li><button className="dropdown-item" onClick={() => {
                                handleChangeRole(selectedUser, 'moderator');
                                setShowUserModal(false);
                              }}>Moderator</button></li>
                              <li><button className="dropdown-item" onClick={() => {
                                handleChangeRole(selectedUser, 'admin');
                                setShowUserModal(false);
                              }}>Admin</button></li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {showBanModal && selectedUser && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Ban User: {selectedUser.username}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowBanModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Banning this user will prevent them from logging in or using any platform features.
                </div>
                
                <div className="mb-3">
                  <label htmlFor="banReason" className="form-label">Ban Reason</label>
                  <textarea 
                    className="form-control" 
                    id="banReason" 
                    rows="3" 
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter reason for banning this user..."
                  ></textarea>
                </div>
                
                <div className="mb-3">
                  <label htmlFor="banDuration" className="form-label">Ban Duration</label>
                  <select 
                    className="form-select" 
                    id="banDuration"
                    value={banDuration}
                    onChange={(e) => setBanDuration(e.target.value)}
                  >
                    <option value="permanent">Permanent</option>
                    <option value="24h">24 Hours</option>
                    <option value="3d">3 Days</option>
                    <option value="7d">7 Days</option>
                    <option value="30d">30 Days</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBanModal(false)}>Cancel</button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={executeBanUser}
                  disabled={!banReason.trim()}
                >
                  <i className="bi bi-ban me-2"></i>
                  Ban User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth role="admin">
      <AdminDashboardPage />
    </RequireAuth>
  );
}
