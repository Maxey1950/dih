'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import RequireAuth from '../../../../../../components/auth/RequireAuth';
import UserAvatar from '../../../../../../components/UserAvatar';
import { forumApi, errorMessage } from '../../../../../../lib/api';

function ReplyToPost() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // New state for success message
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id && id !== 'undefined') {
      fetchPost();
    }
  }, [id]);  

  const fetchPost = async () => {
    if (!id || id === 'undefined') {
      setError('Invalid post ID');
      setLoading(false);
      return;
    }
  
    try {
      const data = await forumApi.getThread(id);
      if (!data?.thread) {
        throw new Error('Post not found');
      }
      setPost(data.thread);
    } catch (err) {
      setError(errorMessage(err, 'Error fetching post'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Reset error state
    setSuccess(null); // Reset success state
    setIsSubmitting(true);

    try {
      if (post?.isLocked) {
        throw new Error('This post is locked and cannot receive new replies');
      }
      if (!replyContent.trim()) {
        throw new Error('Reply content cannot be empty');
      }

      await forumApi.reply(id, replyContent.trim());
      setSuccess('Reply created successfully!');
      setTimeout(() => {
        router.push(`/forum/post/${id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error && !err.status ? err.message : errorMessage(err, 'An error occurred'));
  } finally {
      setIsSubmitting(false);
  }
};

if (loading) {
  return (
    <div className="container py-5">
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-body-secondary">Loading post...</p>
        </div>
      </div>
    </div>
  );
}

if (!post) {
  return (
    <div className="container py-5">
      <div className="alert alert-info rounded-3 shadow-sm" role="alert">
        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-info-circle-fill fs-4"></i>
          <div>Post not found</div>
        </div>
      </div>
    </div>
  );
}

return (
  <div className="container-fluid py-5 bg-body-tertiary">
    <div className="container">
      {/* Modern Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link href="/forum/home" className="text-decoration-none text-primary">
              <i className="bi bi-house-door me-1"></i>Forum
            </Link>
          </li>
          <li className="breadcrumb-item">
            <Link href={`/forum/home?section=${post.section}`} className="text-decoration-none text-primary">
              {post.section}
            </Link>
          </li>
          <li className="breadcrumb-item">
            <Link href={`/forum/post/${id}`} className="text-decoration-none text-primary">
              {post.title}
            </Link>
          </li>
          <li className="breadcrumb-item active fw-medium" aria-current="page">Reply</li>
        </ol>
      </nav>

      {success && ( // Success alert
          <div className="alert alert-success rounded-3 d-flex align-items-center gap-2 mb-4" role="alert">
            <i className="bi bi-check-circle-fill"></i>
            {success}
          </div>
        )}

{error && (
              <div className="alert alert-danger mt-4 rounded-3 d-flex align-items-center gap-2" role="alert">
                <i className="bi bi-exclamation-circle-fill"></i>
                {error}
              </div>
            )}

      <div className="card shadow-sm border-0">
        <div className="card-header bg-primary bg-gradient text-bg-primary py-3">
          <h5 className="mb-0 fw-bold">
            <i className="bi bi-reply-fill me-2"></i>
            Reply to Post
          </h5>
        </div>
        
        <div className="card-body p-4">
          {post?.isLocked && (
            <div className="mb-4">
              <button className="btn btn-danger rounded-pill" disabled>
                <i className="bi bi-lock-fill me-2"></i>POST IS LOCKED
              </button>
            </div>
          )}
          {/* Original Post Preview */}
          <div className="mb-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="position-relative">
                <UserAvatar
                  userId={post.author?.id}
                  alt="Avatar"
                  className="rounded-circle shadow-sm"
                  style={{width: '48px', height: '48px', objectFit: 'cover'}}
                />
                <span className="position-absolute bottom-0 end-0 p-1">
                  <span className="badge bg-success rounded-circle p-1">
                    <span className="visually-hidden">Online</span>
                  </span>
                </span>
              </div>
              <div>
                <h6 className="mb-1 fw-bold">{post.author?.username}</h6>
                <small className="text-body-secondary">
                  <i className="bi bi-clock me-1"></i>
                  Posted on {format(new Date(post.createdAt), 'MMM d, yyyy h:mm a')}
                </small>
              </div>
            </div>
            <div className="bg-body-tertiary rounded-3 p-4 mb-4">
              <p className="text-body-secondary mb-0" style={{whiteSpace: 'pre-wrap'}}>{post.content}</p>
            </div>
          </div>

          {/* Modern Reply Form */}
          <form onSubmit={handleSubmit} className="reply-form">
            <div className="mb-4">
              <label className="form-label fw-medium">
                <i className="bi bi-pencil-square me-2"></i>
                Your Reply
              </label>
              <textarea
                className="form-control form-control-lg shadow-sm"
                rows="6"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                required
                maxLength={2000}
                placeholder="Write your reply here..."
                style={{ resize: 'vertical' }}
                disabled={post?.isLocked}
              />
              <div className="form-text text-end">
                {replyContent.length}/2000 characters
              </div>
            </div>
            
            <div className="d-flex gap-3">
              {post?.isLocked ? (
                <button className="btn btn-danger btn-lg px-4 rounded-pill" disabled>
                  <i className="bi bi-lock-fill me-2"></i>
                  POST IS LOCKED
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary btn-lg px-4 rounded-pill"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-2"></i>
                      Submit Reply
                    </>
                  )}
                </button>
              )}
              <Link 
                href={`/forum/post/${id}`} 
                className="btn btn-secondary btn-lg px-4 rounded-pill"
              >
                <i className="bi bi-x-lg me-2"></i>
                Cancel
              </Link>
            </div>
            

          </form>
        </div>
      </div>
    </div>
  </div>
);
}

export default function ReplyToPostPage() {
  return (
    <RequireAuth>
      <ReplyToPost />
    </RequireAuth>
  );
}
