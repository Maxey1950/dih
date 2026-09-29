'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { forumApi, reportsApi, errorMessage } from '@/lib/api';
import RequireAuth from '@/components/auth/RequireAuth';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

const reportSubjects = [
  'Harassment or Bullying',
  'Inappropriate Content',
  'Spam',
  'Misinformation',
  'Hate Speech',
  'Other'
];

function ReportForumAbuseForm() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const contentType = searchParams.get('type') || 'post'; // 'post' or 'reply'
  const replyId = searchParams.get('replyId'); // Only used if type is 'reply'
  
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  const [contentDetails, setContentDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the post or reply details to show what's being reported
    const fetchContentDetails = async () => {
      try {
        const data = await forumApi.getThread(id);
        const thread = data?.thread;
        if (contentType === 'post' && thread) {
          setContentDetails({
            title: thread.title,
            content: thread.content,
            author: thread.author?.username
          });
        } else if (contentType === 'reply' && replyId && thread) {
          const reply = thread.replies?.find(r => String(r.id) === replyId);
          if (reply) {
            setContentDetails({
              content: reply.content,
              author: reply.author?.username
            });
          }
        }
      } catch (err) {
        setAlert({
          show: true,
          variant: 'danger',
          message: errorMessage(err, 'Error fetching content details')
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContentDetails();
  }, [id, contentType, replyId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await reportsApi.create({
        targetType: contentType === 'reply' ? 'forum_reply' : 'forum_thread',
        targetId: String(contentType === 'reply' ? replyId : id),
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
        router.push(`/forum/post/${id}`);
      }, 2000);
    } catch (err) {
      const message = errorMessage(err, 'Failed to submit report. Please try again later.');
      setAlert({ show: true, variant: 'danger', message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-danger text-white py-3">
              <h4 className="mb-0">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                Report {contentType === 'post' ? 'Forum Post' : 'Reply'}
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {alert.show && (
                <Alert variant={alert.variant} className="mb-4">
                  {alert.message}
                </Alert>
              )}

              {contentDetails && (
                <div className="mb-4 p-3 bg-light rounded">
                  <h5 className="mb-3">You are reporting {contentType === 'post' ? 'a post' : 'a reply'} by {contentDetails.author}</h5>
                  {contentType === 'post' && contentDetails.title && (
                    <div className="mb-2">
                      <strong>Post Title:</strong> {contentDetails.title}
                    </div>
                  )}
                  <div>
                    <strong>Content:</strong>
                    <p className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {contentDetails.content.length > 200 
                        ? `${contentDetails.content.substring(0, 200)}...` 
                        : contentDetails.content}
                    </p>
                  </div>
                </div>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Reason for Report</Form.Label>
                  <Form.Select 
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a reason</option>
                    {reportSubjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Additional Details</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Please provide additional details about why you're reporting this content"
                    required
                  />
                </Form.Group>

                <div className="d-flex gap-3">
                  <Button 
                    variant="danger" 
                    type="submit" 
                    className="px-4"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Submitting...
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                  <Link href={`/forum/post/${id}`} passHref>
                    <Button variant="outline-secondary">Cancel</Button>
                  </Link>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </div>
      </div>
    </Container>
  );
}

export default function ReportForumAbusePage() {
  return (
    <RequireAuth>
      <Suspense>
        <ReportForumAbuseForm />
      </Suspense>
    </RequireAuth>
  );
}
