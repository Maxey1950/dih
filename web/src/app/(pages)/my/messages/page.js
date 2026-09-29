'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import RequireAuth from '../../../../components/auth/RequireAuth';
import { useAuth } from '../../../../contexts/AuthContext';
import { messagesApi, errorMessage } from '../../../../lib/api';

/**
 * Expected message shape (GET /api/messages):
 * { id, senderId, recipientId, sender: { id, username }, recipient: { id, username },
 *   subject, content, isRead, isArchived, createdAt }
 */

function MessagesPage() {
    const router = useRouter();
    const { user } = useAuth();
    const currentUserId = user?.id;
    const [messages, setMessages] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('received');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMessages();
    }, []);

    useEffect(() => {
        if (selectedMessage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedMessage]);

    const fetchMessages = async () => {
        try {
            const data = await messagesApi.list();
            setMessages(data?.messages ?? []);
        } catch (err) {
            setError(errorMessage(err, 'Failed to fetch messages'));
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (messageId) => {
        try {
            await messagesApi.update(messageId, { isRead: true });
            fetchMessages();
        } catch {
            /* non-critical */
        }
    };

    const handleArchiveMessage = async (messageId) => {
        try {
            await messagesApi.update(messageId, { isArchived: true });
            fetchMessages();
        } catch (err) {
            setError(errorMessage(err, 'Failed to archive message'));
        }
    };

    const handleUnarchiveMessage = async (messageId) => {
        try {
            await messagesApi.update(messageId, { isArchived: false });
            fetchMessages();
        } catch (err) {
            setError(errorMessage(err, 'Failed to unarchive message'));
        }
    };

    const isMine = (id) => currentUserId !== undefined && String(id) === String(currentUserId);

    const handleMessageClick = (message) => {
        setSelectedMessage(message);
        if (!message.isRead && isMine(message.recipientId)) {
            markAsRead(message.id);
        }
    };

    const filteredMessages = messages.filter(message => {
        if (activeTab === 'received') {
            return isMine(message.recipientId) && !message.isArchived;
        } else if (activeTab === 'sent') {
            return isMine(message.senderId);
        } else if (activeTab === 'archived') {
            return isMine(message.recipientId) && message.isArchived;
        }
        return false;
    });

    const unreadCount = messages.filter(m => !m.isRead && !m.isArchived && isMine(m.recipientId)).length;

    const formatMessageContent = (content) => {
        const parts = content.split('---Original Message---');
        if (parts.length > 1) {
            return (
                <>
                    <div className="mb-3">{parts[0].trim()}</div>
                    <div className="border-start border-2 border-primary-subtle ps-3 mt-3">
                        <div className="text-body-secondary mb-2">
                            <i className="bi bi-chat-quote me-2"></i>
                            Original Message
                        </div>
                        <div className="text-body-secondary">
                            {parts[1].trim()}
                        </div>
                    </div>
                </>
            );
        }
        return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
    };

    return (
        <div className="container-fluid py-5 bg-body-tertiary">
            <div className="container">
                <div className="card shadow-sm border-0">
                    <div className="card-header bg-primary bg-gradient text-white">
                        <h5 className="mb-0">
                            <i className="bi bi-envelope me-2"></i>
                            Messages
                        </h5>
                    </div>
                    <div className="card-body">
                        <ul className="nav nav-tabs nav-fill mb-4">
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${activeTab === 'received' ? 'active' : ''}`} 
                                    onClick={() => setActiveTab('received')}
                                >
                                    <i className="bi bi-inbox me-2"></i>
                                    Inbox
                                    {unreadCount > 0 && (
                                        <span className="badge bg-primary ms-2">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${activeTab === 'sent' ? 'active' : ''}`} 
                                    onClick={() => setActiveTab('sent')}
                                >
                                    <i className="bi bi-send me-2"></i>
                                    Sent
                                </button>
                            </li>
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${activeTab === 'archived' ? 'active' : ''}`} 
                                    onClick={() => setActiveTab('archived')}
                                >
                                    <i className="bi bi-archive me-2"></i>
                                    Archived
                                </button>
                            </li>
                        </ul>

                        {error && (
                            <div className="alert alert-danger">
                                <i className="bi bi-exclamation-circle-fill me-2"></i>
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr>
                                            <th style={{ width: '40%' }}>Subject</th>
                                            <th>{activeTab === 'sent' ? 'To' : 'From'}</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                            {(activeTab === 'received' || activeTab === 'archived') && (
                                                <th style={{ width: '100px' }}>Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMessages.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-4">
                                                    <i className="bi bi-inbox text-muted me-2"></i>
                                                    No messages found
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMessages.map(message => (
                                                <tr key={message.id} className={!message.isRead && activeTab === 'received' ? 'table-active' : ''}>
                                                    <td onClick={() => handleMessageClick(message)} style={{ cursor: 'pointer' }}>
                                                        {!message.isRead && activeTab === 'received' && (
                                                            <span className="badge bg-primary me-2">New</span>
                                                        )}
                                                        {message.subject}
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2"
                                                                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <i className="bi bi-person text-primary"></i>
                                                            </div>
                                                            {activeTab === 'sent' ? message.recipient?.username : message.sender?.username}
                                                        </div>
                                                    </td>
                                                    <td>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</td>
                                                    <td>
                                                        {activeTab === 'received' ? (
                                                            message.isRead ? (
                                                                <span className="text-muted">
                                                                    <i className="bi bi-check2-all me-1"></i>
                                                                    Read
                                                                </span>
                                                            ) : (
                                                                <span className="text-primary">
                                                                    <i className="bi bi-envelope-fill me-1"></i>
                                                                    Unread
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-success">
                                                                <i className="bi bi-check2 me-1"></i>
                                                                Sent
                                                            </span>
                                                        )}
                                                    </td>
                                                    {(activeTab === 'received' || activeTab === 'archived') && (
                                                        <td>
                                                            {activeTab === 'received' ? (
                                                                <button
                                                                    className="btn btn-outline-danger btn-sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleArchiveMessage(message.id);
                                                                    }}
                                                                    title="Archive message"
                                                                >
                                                                    <i className="bi bi-archive"></i>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="btn btn-outline-primary btn-sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUnarchiveMessage(message.id);
                                                                    }}
                                                                    title="Unarchive message"
                                                                >
                                                                    <i className="bi bi-archive"></i>
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Message Modal */}
            {selectedMessage && (
                <>
                    <div className="modal d-block" tabIndex="-1">
                        <div className="modal-dialog modal-lg modal-dialog-centered">
                            <div className="modal-content border-0 shadow">
                                <div className="modal-header bg-primary bg-gradient text-white">
                                    <div>
                                        <h5 className="modal-title mb-1">{selectedMessage.subject}</h5>
                                        <div className="small opacity-75">
                                            <i className="bi bi-clock me-2"></i>
                                            {formatDistanceToNow(new Date(selectedMessage.createdAt), { addSuffix: true })}
                                        </div>
                                    </div>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedMessage(null)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="message-header d-flex justify-content-between align-items-start mb-4">
                                        <div className="d-flex gap-3">
                                            <div className="rounded-circle bg-primary bg-opacity-10 p-3"
                                                style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <i className="bi bi-person text-primary fs-5"></i>
                                            </div>
                                            <div>
                                                <div className="text-body-secondary">From</div>
                                                <div className="fw-medium">{selectedMessage.sender?.username}</div>
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <div className="text-body-secondary">To</div>
                                            <div className="fw-medium">{selectedMessage.recipient?.username}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="message-content bg-body-tertiary p-4 rounded">
                                        {formatMessageContent(selectedMessage.content)}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button 
                                        type="button" 
                                        className="btn btn-light" 
                                        onClick={() => setSelectedMessage(null)}
                                    >
                                        <i className="bi bi-x-lg me-2"></i>
                                        Close
                                    </button>
                                    {activeTab === 'received' && !selectedMessage.isArchived && (
                                        <>
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger"
                                                onClick={() => {
                                                    handleArchiveMessage(selectedMessage.id);
                                                    setSelectedMessage(null);
                                                }}
                                            >
                                                <i className="bi bi-archive me-2"></i>
                                                Archive
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={() => {
                                                    setSelectedMessage(null);
                                                    router.push(`/my/messages/reply/${selectedMessage.id}`);
                                                }}
                                            >
                                                <i className="bi bi-reply-fill me-2"></i>
                                                Reply
                                            </button>
                                        </>
                                    )}
                                    {activeTab === 'archived' && (
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => {
                                                handleUnarchiveMessage(selectedMessage.id);
                                                setSelectedMessage(null);
                                            }}
                                        >
                                            <i className="bi bi-archive me-2"></i>
                                            Unarchive
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop show"></div>
                </>
            )}
        </div>
    );
}

export default function Messages() {
    return (
        <RequireAuth>
            <MessagesPage />
        </RequireAuth>
    );
}
