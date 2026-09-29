'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { reportsApi, errorMessage } from '@/lib/api';
import RequireAuth from '@/components/auth/RequireAuth';
import { toast } from 'react-hot-toast';

const reportSubjects = [
  'Harassment or Bullying',
  'Inappropriate Content',
  'Spam',
  'Impersonation',
  'Other'
];

function ReportAbuseForm({ userId }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await reportsApi.create({
        targetType: 'user',
        targetId: String(userId),
        reason: formData.subject,
        details: formData.description,
      });
      setAlert({
        show: true,
        variant: 'success',
        message: 'Report submitted successfully'
      });
      toast.success('Report submitted successfully');
      setTimeout(() => {
        router.push(`/user/${userId}/profile`);
      }, 2000);
    } catch (err) {
      const message = errorMessage(err, 'Failed to submit report. Please try again later.');
      setAlert({ show: true, variant: 'danger', message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Container className="py-4">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h2 className="mb-4">Report User</h2>
          {alert.show && (
            <Alert 
              variant={alert.variant} 
              onClose={() => setAlert({...alert, show: false})} 
              dismissible
            >
              {alert.message}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Subject</Form.Label>
              <Form.Select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
              >
                <option value="">Select a subject</option>
                {reportSubjects.map(subject => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Please provide details about your report..."
                required
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button
                variant="primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => router.push(`/user/${userId}/profile`)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default function ReportAbusePage({ params }) {
  const { userId } = React.use(params);
  return (
    <RequireAuth>
      <ReportAbuseForm userId={userId} />
    </RequireAuth>
  );
}
