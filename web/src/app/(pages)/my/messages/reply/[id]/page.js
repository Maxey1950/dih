'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import RequireAuth from '../../../../../../components/auth/RequireAuth';
import { messagesApi, errorMessage } from '../../../../../../lib/api';

function ReplyMessagePage() {
  const params = useParams();
  const router = useRouter();
  const [originalMessage, setOriginalMessage] = useState(null);
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOriginalMessage();
  }, [params.id]);

  const fetchOriginalMessage = async () => {
    try {
      const data = await messagesApi.get(params.id);
      const message = data?.message;
      if (!message || !message.sender || !message.content) {
        throw new Error('Invalid message data received');
      }
      setOriginalMessage(message);
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch original message'));
    } finally {
      setLoading(false);
    }
  };

  const formatMessageContent = (content) => {
    // Split content by the original message separator if it exists
    const parts = content.split('---Original Message---');
    if (parts.length > 1) {
      return (
        <>
          <div className="mb-3">{parts[0].trim()}</div>
          <div className="border-top pt-3">
            <div className="text-body-secondary mb-2">
              <i className="bi bi-chat-quote me-2"></i>
              Original Message
            </div>
            <div className="ps-3 border-start border-primary">
              {parts[1].trim()}
            </div>
          </div>
        </>
      );
    }
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Reply message cannot be empty');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      const messageContent = includeOriginal
        ? `${content.trim()}\n\n---Original Message---\n${originalMessage.content}`
        : content.trim();

      await messagesApi.send({
        recipientId: originalMessage.senderId,
        subject: `Re: ${originalMessage.subject}`,
        content: messageContent
      });

      router.push('/my/messages');
    } catch (err) {
      setError(errorMessage(err, 'Failed to send message'));
      setIsSubmitting(false);
    }
  };

  // Add error boundary for when originalMessage is null
  if (!loading && !originalMessage) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Message not found or you don't have permission to view it.
        </div>
        <Link href="/my/messages" className="btn btn-primary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Messages
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link href="/my/messages" className="text-decoration-none">Messages</Link>
            </li>
            <li className="breadcrumb-item active">Reply</li>
          </ol>
        </nav>

        <div className="row">
          <div className="col-md-8">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Reply to Message</h5>
                <span className="badge bg-light text-primary">
                  <i className="bi bi-reply-fill me-1"></i>
                  Reply
                </span>
              </div>
              <div className="card-body p-4">
                {/* Original Message Preview */}
                <div className="mb-4">
                  <div className="message-header p-3 bg-light rounded-top border-bottom">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-3"
                            style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="bi bi-person text-primary"></i>
                          </div>
                          <div>
                            <div className="fw-medium">{originalMessage.sender?.username}</div>
                            <div className="small text-body-secondary">
                              <i className="bi bi-clock me-1"></i>
                              {formatDistanceToNow(new Date(originalMessage.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6 text-md-end mt-2 mt-md-0">
                        <div className="text-body-secondary">Subject:</div>
                        <div className="fw-medium">{originalMessage.subject}</div>
                      </div>
                    </div>
                  </div>
                  <div className="message-content p-3 bg-body-tertiary rounded-bottom">
                    {formatMessageContent(originalMessage.content)}
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger">
                    <i className="bi bi-exclamation-circle-fill me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label d-flex justify-content-between">
                      <span>Your Reply</span>
                      <span className="text-body-secondary small">
                        {content.length}/2000 characters
                      </span>
                    </label>
                    <textarea
                      className="form-control"
                      rows="6"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      maxLength={2000}
                      placeholder="Write your reply here..."
                    />
                  </div>

                  <div className="mb-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="includeOriginal"
                        checked={includeOriginal}
                        onChange={(e) => setIncludeOriginal(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="includeOriginal">
                        <i className="bi bi-quote me-2"></i>
                        Include original message in reply
                      </label>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-fill me-2"></i>
                          Send Reply
                        </>
                      )}
                    </button>
                    <Link href="/my/messages" className="btn btn-light">
                      <i className="bi bi-x-lg me-2"></i>
                      Cancel
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Tips Column */}
          <div className="col-md-4">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">
                  <i className="bi bi-lightbulb me-2"></i>
                  Tips
                </h5>
              </div>
              <div className="card-body">
                <ul className="list-unstyled mb-0">
                  <li className="mb-3">
                    <i className="bi bi-check2-circle text-success me-2"></i>
                    Keep your reply clear and concise
                  </li>
                  <li className="mb-3">
                    <i className="bi bi-check2-circle text-success me-2"></i>
                    Include relevant details from the original message
                  </li>
                  <li>
                    <i className="bi bi-check2-circle text-success me-2"></i>
                    Be respectful and professional
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReplyMessage() {
  return (
    <RequireAuth>
      <ReplyMessagePage />
    </RequireAuth>
  );
}
