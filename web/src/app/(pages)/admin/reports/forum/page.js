'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, Tabs, Tab } from 'react-bootstrap';
import { adminApi, errorMessage } from '@/lib/api';
import RequireAuth from '@/components/auth/RequireAuth';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

function AdminForumReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  /**
   * Expected GET /api/admin/reports?type=forum response:
   * { reports: [{ id, reporterId, targetType, targetId, reason, details, status, createdAt }] }
   */
  const fetchReports = async () => {
    try {
      const data = await adminApi.reports({ type: 'forum' });
      setReports(data?.reports ?? []);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to fetch reports'));
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId, newStatus) => {
    try {
      await adminApi.updateReport(reportId, { status: newStatus });
      toast.success('Report status updated successfully');
      setReports(reports.map(report =>
        report.id === reportId ? { ...report, status: newStatus } : report
      ));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update report status'));
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'reviewed': return 'info';
      case 'resolved': return 'success';
      default: return 'secondary';
    }
  };

  const getContentTypeLabel = (targetType) => {
    return targetType === 'forum_thread' ? 'Forum Post' : 'Forum Reply';
  };

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">Loading forum reports...</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Forum Content Reports</h2>
        <Link href="/admin/reports" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to User Reports
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="text-center p-5 bg-light rounded">
          <i className="bi bi-check-circle display-4 text-success mb-3"></i>
          <p className="lead">No forum reports found</p>
        </div>
      ) : (
        <Table responsive striped hover className="shadow-sm">
          <thead className="bg-light">
            <tr>
              <th>Reporter ID</th>
              <th>Content Type</th>
              <th>Content ID</th>
              <th>Subject</th>
              <th>Description</th>
              <th>Status</th>
              <th>Reported On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.reporterId}</td>
                <td>
                  <Badge bg="info" className="text-white">
                    {getContentTypeLabel(report.targetType)}
                  </Badge>
                </td>
                <td>
                  {report.targetType === 'forum_thread' ? (
                    <Link href={`/forum/post/${report.targetId}`} target="_blank" className="text-decoration-none">
                      {report.targetId}
                      <i className="bi bi-box-arrow-up-right ms-1 small"></i>
                    </Link>
                  ) : (
                    <span>{report.targetId}</span>
                  )}
                </td>
                <td>{report.reason}</td>
                <td>
                  <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {report.details}
                  </div>
                </td>
                <td>
                  <Badge bg={getStatusBadgeVariant(report.status)}>
                    {report.status}
                  </Badge>
                </td>
                <td>{new Date(report.createdAt).toLocaleString()}</td>
                <td>
                  <div className="d-flex gap-2">
                    {report.status === 'pending' && (
                      <Button 
                        variant="outline-info" 
                        size="sm"
                        onClick={() => updateReportStatus(report.id, 'reviewed')}
                      >
                        Mark Reviewed
                      </Button>
                    )}
                    {(report.status === 'pending' || report.status === 'reviewed') && (
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={() => updateReportStatus(report.id, 'resolved')}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}

export default function AdminForumReportsPageGuarded() {
  return (
    <RequireAuth role="admin">
      <AdminForumReportsPage />
    </RequireAuth>
  );
}
