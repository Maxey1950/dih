"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usersApi, errorMessage } from "../../../lib/api";
import { debounce } from "../../../lib/utils/debounce";
import UserAvatar from "../../../components/UserAvatar";

/**
 * Expected GET /api/users?query=&page=&limit= response:
 * { users: [{ id, username, blurb, isOnline, lastSeenAt }], page, totalPages, total }
 * Search and paging are done by the server; the client never downloads every user.
 */
export default function UsersPage() {
  const [pageUsers, setPageUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      try {
        const data = await usersApi.list({ query, page: currentPage, limit: usersPerPage });
        if (cancelled) return;
        setPageUsers(data?.users ?? []);
        setTotal(data?.total ?? 0);
        setTotalPages(Math.max(1, data?.totalPages ?? 1));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Failed to fetch users"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsers();
    // Poll for online status updates every 30 seconds.
    const intervalId = setInterval(fetchUsers, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [query, currentPage]);

  const handleSearch = useMemo(
    () =>
      debounce((value) => {
        setQuery(value.trim());
        setCurrentPage(1);
      }, 300),
    []
  );
  useEffect(() => () => handleSearch.cancel(), [handleSearch]);

  const getCurrentPageUsers = () => pageUsers;

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
            <div className="row">
                <div className="col-12">
                    <div className="card shadow-sm border-0">
                        {/* Header Section */}
                        <div className="card-header bg-primary bg-gradient text-white p-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h4 className="mb-1">Users</h4>
                                    <p className="mb-0 text-white-50">Browse and connect with other users</p>
                                </div>
                                <span className="badge bg-white text-primary fs-6">
                                    {total} Users
                                </span>
                            </div>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-0">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input type="text" className="form-control border-0 py-2" placeholder="Search users by username..." onChange={(e) => {setSearchTerm(e.target.value); handleSearch(e.target.value);}} value={searchTerm} />
                            </div>
                        </div>

                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-body-secondary">
                                        <tr>
                                            <th className="px-4 py-3">User</th>
                                            <th className="px-4 py-3">Blurb</th>
                                            <th className="px-4 py-3">Last Online</th>
                                            <th className="px-4 py-3">Actions</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    {loading ? (
                                      <tr>
                                        <td colSpan="5" className="text-center py-5">
                                          <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : (
                                      getCurrentPageUsers().map((user) => (
                                        <tr key={user.id}>
                                            <td className="px-4 py-3">
                                                <div className="d-flex align-items-center">
                                                    <Link href={`/user/${user.id}/profile`} className="d-flex align-items-center text-decoration-none">
                                                        <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: "48px", height: "48px", overflow: "hidden", }}>
                                                            <UserAvatar userId={user.id} alt={user.username} className="w-100 h-100 object-fit-cover"/>
                                                        </div>
                                                        <div>
                                                            <h6 className="mb-0 text-primary text-decoration-underline">{user.username}</h6>
                                                            <small className="text-body-secondary">@{user.username.toLowerCase()}</small>
                                                        </div>
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-body-secondary mb-0 text-truncate" style={{ maxWidth: "300px" }}>
                                                  {user.blurb || "This user hasn't written anything yet."}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <small className="text-body-secondary">
                                                    {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString('en-US', {
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
                                                <Link href={`/user/${user.id}/profile`} className="btn btn-outline-primary btn-sm">
                                                    <i className="bi bi-person-badge me-2"></i>
                                                    View Profile
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`badge bg-${user.isOnline ? "success" : "danger"}`}>
                                                    <i className="bi bi-circle-fill me-1"></i>
                                                    {user.isOnline ? "Online" : "Offline"}
                                                </span>
                                            </td>
                                        </tr>
                                    )))}
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
    </div>
  );
}
