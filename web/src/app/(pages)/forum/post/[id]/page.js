'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../../../contexts/AuthContext';
import { forumApi, errorMessage } from '../../../../../lib/api';
import LinkifiedText from '../../../../../components/LinkifiedText';
import UserAvatar from '../../../../../components/UserAvatar';


export default function ForumPost() {
    const { id } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user: currentUser } = useAuth();
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        fetchPost();
        const interval = setInterval(fetchPost, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /**
     * Expected GET /api/forum/threads/:id response:
     * { thread: { id, title, section, content, isLocked, isPinned, createdAt,
     *             author: { id, username, role, isOnline, createdAt, postCount },
     *             replies: [{ id, content, createdAt, author: {...} }] } }
     * `content` is plain text; it is rendered with <LinkifiedText>, never as HTML.
     */
    const fetchPost = async () => {
        try {
            const data = await forumApi.getThread(id);
            setPost(data?.thread ?? null);
        } catch (err) {
            setError(errorMessage(err, 'Error fetching post'));
        } finally {
            setLoading(false);
        }
    };

    // UI hint only; the API enforces moderator permissions.
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

    const handleToggleLock = async (lock) => {
        try {
            setActionError('');
            await forumApi.moderate(id, { locked: lock });
            await fetchPost();
        } catch (err) {
            setActionError(errorMessage(err, 'Failed to update lock state'));
        }
    };

    const handleTogglePin = async (pin) => {
        try {
            setActionError('');
            await forumApi.moderate(id, { pinned: pin });
            await fetchPost();
        } catch (err) {
            setActionError(errorMessage(err, 'Failed to update pin state'));
        }
    };

    if (loading) {
        return (
            <div className="container py-4">
                <div className="text-center">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="container py-4">
                <div className="alert alert-info" role="alert">
                    Post not found
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
                            <Link href={`/forum/home?section=${encodeURIComponent(post.section)}`} className="text-decoration-none text-primary">
                                {post.section}
                            </Link>
                        </li>
                        <li className="breadcrumb-item active fw-medium" aria-current="page">{post.title}</li>
                    </ol>
                </nav>

                {/* Main Post Card */}
                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-header bg-primary bg-gradient text-bg-primary d-flex justify-content-between align-items-center py-3">
                        <div className="d-flex align-items-center gap-3">
                            <h5 className="mb-0 fw-bold">Original Post</h5>
                            <small className="opacity-75">
                                <i className="bi bi-clock me-1"></i>
                                Posted on {format(new Date(post.createdAt), 'MMM dd, yyyy, h:mm a')}
                            </small>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            {post.isLocked === true && (
                                <button className="btn btn-danger btn-sm rounded-pill" disabled>
                                    <i className="bi bi-lock-fill me-2"></i>POST IS LOCKED
                                </button>
                            )}
                            {post.isPinned === true && (
                                <button className="btn btn-info btn-sm rounded-pill" disabled>
                                    <i className="bi bi-pin-angle-fill me-2"></i>PINNED
                                </button>
                            )}
                            {isAdmin && (
                                <>
                                    {post.isLocked === true ? (
                                        <button className="btn btn-outline-warning btn-sm rounded-pill" onClick={() => handleToggleLock(false)}>
                                            <i className="bi bi-unlock-fill me-2"></i>Unlock Post
                                        </button>
                                    ) : (
                                        <button className="btn btn-outline-danger btn-sm rounded-pill" onClick={() => handleToggleLock(true)}>
                                            <i className="bi bi-lock-fill me-2"></i>Lock Post
                                        </button>
                                    )}
                                    {post.isPinned === true ? (
                                        <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => handleTogglePin(false)}>
                                            <i className="bi bi-pin-angle me-2"></i>Unpin Post
                                        </button>
                                    ) : (
                                        <button className="btn btn-outline-info btn-sm rounded-pill" onClick={() => handleTogglePin(true)}>
                                            <i className="bi bi-pin-angle-fill me-2"></i>Pin Post
                                        </button>
                                    )}
                                    {actionError && (
                                        <span className="text-danger small">{actionError}</span>
                                    )}
                                </>
                            )}
                            <span className="badge bg-primary-subtle text-primary rounded-pill px-3">
                                {post.section}
                            </span>
                        </div>
                    </div>

                    <div className="card-body p-4">
                        <div className="row">
                            {/* Author Info Column */}
                            <div className="col-md-3">
                                <div className="text-center p-3 bg-body-tertiary rounded-3">
                                    <UserAvatar
                                        userId={post.author?.id}
                                        alt="Avatar"
                                        className="rounded-circle mb-3 shadow-sm"
                                        style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                    />
                                    <Link href={`/user/${post.author?.id}/profile`}>
                                        <h6 className="fw-bold mb-2">{post.author?.username}</h6>
                                    </Link>
                                    {post.author?.role === 'admin' && (
                                        <div className="mb-2">
                                            <span className="badge bg-primary-subtle text-primary rounded-pill">Administrator</span>
                                        </div>
                                    )}
                                    <div className="mb-3">
                                        <span className={`badge ${post.author?.isOnline ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                                            <i className="bi bi-circle-fill me-1"></i>
                                            {post.author?.isOnline ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                    <div className="text-body-secondary small">
                                        <div className="mb-2">
                                            <i className="bi bi-calendar3 me-2"></i>
                                            Joined {format(new Date(post.author?.createdAt || post.createdAt), 'MMM dd, yyyy')}
                                        </div>
                                        <div>
                                            <i className="bi bi-chat-square-text me-2"></i>
                                            {post.author?.postCount || 0} posts
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Post Content Column */}
                            <div className="col-md-9">
                                <div className="p-3">
                                    <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                                        <LinkifiedText text={post.content} />
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer py-3 d-flex justify-content-between">
                        {post.isLocked === true ? (
                            <button className="btn btn-danger rounded-pill px-4" disabled>
                                <i className="bi bi-lock-fill me-2"></i>
                                POST IS LOCKED
                            </button>
                        ) : (
                            <Link
                                href={`/forum/new/reply/${post.id}`}
                                className="btn btn-primary rounded-pill px-4"
                            >
                                <i className="bi bi-reply-fill me-2"></i>
                                Reply to Post
                            </Link>
                        )}
                        <Link
                            href={`/reportabuse/forum/${id}?type=post`}
                            className="btn btn-outline-danger rounded-pill px-3"
                        >
                            <i className="bi bi-flag-fill me-2"></i>
                            Report Post
                        </Link>
                    </div>
                </div>

                {/* Replies Section */}
                <div className="mt-5">
                    <h4 className="mb-4 fw-bold">
                        <i className="bi bi-chat-square-text me-2"></i>
                        Replies ({post.replies?.length || 0})
                    </h4>

                    {post.replies?.length > 0 ? (
                        <div className="replies-list">
                            {post.replies.map((reply, index) => (
                                <div key={reply.id} className="card shadow-sm border-0 mb-4">
                                    <div className="card-header d-flex justify-content-between align-items-center py-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-primary-subtle text-primary rounded-pill">
                                                #{index + 1}
                                            </span>
                                            <small className="text-body-secondary">
                                                <i className="bi bi-clock me-1"></i>
                                                Replied on {format(new Date(reply.createdAt), 'MMM dd, yyyy, h:mm a')}
                                            </small>
                                        </div>
                                        <Link
                                            href={`/reportabuse/forum/${id}?type=reply&replyId=${reply.id}`}
                                            className="btn btn-sm btn-outline-danger rounded-pill px-2"
                                        >
                                            <i className="bi bi-flag-fill me-1"></i>
                                            Report
                                        </Link>
                                    </div>
                                    <div className="card-body p-4">
                                        <div className="row">
                                            {/* Reply Author Info */}
                                            <div className="col-md-3">
                                                <div className="text-center p-3 bg-body-tertiary rounded-3">
                                                    <UserAvatar
                                                        userId={reply.author?.id}
                                                        alt="Avatar"
                                                        className="rounded-circle mb-3 shadow-sm"
                                                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                                                    />
                                                    <Link href={`/user/${reply.author?.id}/profile`}>
                                                        <h6 className="fw-bold mb-2">{reply.author?.username}</h6>
                                                    </Link>
                                                    {reply.author?.role === 'admin' && (
                                                        <div className="mb-2">
                                                            <span className="badge bg-primary-subtle text-primary rounded-pill">Administrator</span>
                                                        </div>
                                                    )}
                                                    <div className="mb-3">
                                                        <span className={`badge ${reply.author?.isOnline ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                                                            <i className="bi bi-circle-fill me-1"></i>
                                                            {reply.author?.isOnline ? 'Online' : 'Offline'}
                                                        </span>
                                                    </div>
                                                    <div className="text-body-secondary small">
                                                        <div className="mb-2">
                                                            <i className="bi bi-calendar3 me-2"></i>
                                                            Joined {format(new Date(reply.author?.createdAt || reply.createdAt), 'MMM dd, yyyy')}
                                                        </div>
                                                        <div>
                                                            <i className="bi bi-chat-square-text me-2"></i>
                                                            {reply.author?.postCount || 0} posts
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Reply Content */}
                                            <div className="col-md-9">
                                                <div className="p-3">
                                                    <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                                                        <LinkifiedText text={reply.content} />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-5 bg-body-tertiary rounded-3">
                            <i className="bi bi-chat-square-text display-4 text-body-secondary mb-3"></i>
                            <p className="text-body-secondary mb-0">No replies yet. Be the first to reply!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}