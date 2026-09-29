'use client';

import { useState, useEffect } from 'react';
import { Container, Table, Badge, Button } from 'react-bootstrap';
import { adminApi, errorMessage } from '@/lib/api';
import RequireAuth from '@/components/auth/RequireAuth';
import { toast } from 'react-hot-toast';

function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  /**
   * Expected GET /api/admin/reports?type=user response:
   * { reports: [{ id, reporterId, targetType, targetId, reason, details, status, createdAt }] }
   */
  const fetchReports = async () => {
    try {
      const data = await adminApi.reports({ type: 'user' });
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

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">Loading reports...</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">User Reports</h2>
      {reports.length === 0 ? (
        <div className="text-center">No reports found</div>
      ) : (
        <Table responsive striped hover>
          <thead>
            <tr>
              <th>Reporter ID</th>
              <th>Reported User ID</th>
              <th>Subject</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.reporterId}</td>
                <td>{report.targetId}</td>
                <td>{report.reason}</td>
                <td>{report.details}</td>
                <td>
                  <Badge bg={getStatusBadgeVariant(report.status)}>
                    {report.status}
                  </Badge>
                </td>
                <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="d-flex gap-2">
                    {report.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="info"
                        onClick={() => updateReportStatus(report.id, 'reviewed')}
                      >
                        Mark Reviewed
                      </Button>
                    )}
                    {report.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="success"
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

export default function AdminReportsPageGuarded() {
  return (
    <RequireAuth role="admin">
      <AdminReportsPage />
    </RequireAuth>
  );
}
