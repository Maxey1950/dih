'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import ForumBetaAlert from '@/components/Alerts/ForumAlert';
import { forumApi, errorMessage } from '@/lib/api';

const sectionGroups = {
    AlphaBlox: {
        sections: [
            {
                name: 'Announcements',
                icon: 'bi-broadcast',
                description: 'Official announcements from the AlphaBlox team'
            },
            {
                name: 'Change Log',
                icon: 'bi-journal-richtext',
                description: 'View the latest changes made to AlphaBlox'
            }
        ]
    },
    General: {
        sections: [
            {
                name: 'General Discussion',
                icon: 'bi-chat-square-text',
                description: 'Discuss anything related to AlphaBlox'
            },
            {
                name: 'Suggestions and Ideas',
                icon: 'bi-lightbulb',
                description: 'Suggestions and ideas for AlphaBlox'
            },
            {
                name: 'Off Topic',
                icon: 'bi-chat-square-heart',
                description: 'Chat about anything not related to AlphaBlox'
            },
            {
                name: 'Media',
                icon: 'bi-image',
                description: 'Share media with the community'
            },
            {
                name: 'Asset Sharing',
                icon: 'bi-share-fill',
                description: 'Share your assets with the community'
            },
            {
                name: 'Tutorials',
                icon: 'bi-book',
                description: 'Share your tutorials here'
            }
        ]
    },
    Gaming: {
        sections: [
            {
                name: 'Gaming',
                icon: 'bi-joystick',
                description: 'Discuss gaming topics and share your experiences'
            },
            {
                name: 'Roblox',
                icon: 'bi-dice-6',
                description: 'Everything related to Roblox games and development'
            }
        ]
    },
    Other: {
        sections: [
            {
                name: 'Others',
                icon: 'bi-collection',
                description: 'Topics that don\'t fit in other categories'
            },
            {
                name: 'Support',
                icon: 'bi-question-circle',
                description: 'Get help with any issues youre experiencing'
            },
            {
                name: 'Rate My Character',
                icon: 'bi-star',
                description: 'Rate my character'
            },
            {
                name: 'Memes',
                icon: 'bi-emoji-laughing',
                description: 'Funny stuff goes here'
            }
        ]
    }
};

export default function ForumHome() {
    const [posts, setPosts] = useState([]);
    const [selectedSection, setSelectedSection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPosts();
    }, [selectedSection]);

    /** Expected GET /api/forum/threads response: { threads: [{ id, title, section, author: { id, username }, repliesCount, isPinned, isLocked, createdAt, lastReply?: { createdAt, author: { username } } }] } */
    const fetchPosts = async () => {
        try {
            const data = await forumApi.listThreads({ section: selectedSection ?? undefined });
            setPosts(data?.threads ?? []);
        } catch (err) {
            setError(errorMessage(err, 'Failed to load forum'));
        } finally {
            setLoading(false);
        }
    };

    // Group posts by section and sort each section (pinned first, then by date)
    const groupedPosts = posts.reduce((acc, post) => {
        if (!acc[post.section]) {
            acc[post.section] = [];
        }
        acc[post.section].push(post);
        return acc;
    }, {});

    // Sort each section's posts: pinned first, then by creation date
    Object.keys(groupedPosts).forEach(section => {
        groupedPosts[section].sort((a, b) => {
            // First sort by pinned status (pinned posts first)
            // Handle undefined/null values - treat as false
            const aPinned = a.isPinned === true;
            const bPinned = b.isPinned === true;
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            // Then sort by creation date (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    });

    return (
        <div className="container-fluid py-5 bg-body-tertiary">
            <div className="container">
                <ForumBetaAlert />
                <div className="row g-4">
                    {/* Modern Left Sidebar */}
                    <div className="col-md-3">
                        <div className="card shadow-sm border-0">
                            <div className="card-body">
                                <Link href="/forum/new/post" className="btn btn-primary w-100 rounded-3 d-flex align-items-center justify-content-center gap-2">
                                    <i className="bi bi-plus-circle"></i>
                                    Create New Topic
                                </Link>
                            </div>
                        </div>

                        <div className="card shadow-sm border-0 mt-4">
                            <div className="card-header bg-primary bg-gradient text-bg-primary">
                                <h5 className="mb-0 fw-bold">Categories</h5>
                            </div>
                            <div className="list-group list-group-flush">
                                <button
                                    onClick={() => setSelectedSection(null)}
                                    className="list-group-item list-group-item-action d-flex align-items-center gap-2"
                                >
                                    <i className="bi bi-grid-3x3-gap"></i>
                                    All Sections
                                </button>

                                {Object.entries(sectionGroups).map(([groupName, group]) => (
                                    <div key={groupName}>
                                        <div className="list-group-item bg-primary-subtle">
                                            <strong className="text-primary">{groupName}</strong>
                                        </div>
                                        {group.sections.map((section) => (
                                            <button
                                                key={section.name}
                                                onClick={() => setSelectedSection(section.name)}
                                                className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${selectedSection === section.name ? 'active' : ''
                                                    }`}
                                            >
                                                <i className={`bi ${section.icon}`}></i>
                                                {section.name}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="col-md-9">
                        <div className="d-flex align-items-center gap-2 mb-4">
                            <h2 className="h4 mb-0 fw-bold">{selectedSection || 'All Sections'}</h2>
                            <span className="badge bg-primary rounded-pill">
                                {posts.length} Topics
                            </span>
                        </div>

                        <p className="text-body-secondary mb-4">
                            {selectedSection
                                ? Object.values(sectionGroups)
                                    .flatMap(group => group.sections)
                                    .find(section => section.name === selectedSection)?.description
                                : 'View all posts from every section of the forum.'
                            }
                        </p>

                        {error && (
                            <div className="alert alert-danger" role="alert">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="d-flex justify-content-center p-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            Object.entries(selectedSection ? { [selectedSection]: groupedPosts[selectedSection] || [] } : groupedPosts)
                                .map(([section, sectionPosts]) => (
                                    <div key={section} className="mb-4">
                                        <div className="card shadow-sm border-0">
                                            <div className="card-header bg-primary bg-gradient text-bg-primary">
                                                <h3 className="h5 mb-0 fw-bold">{section}</h3>
                                            </div>
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th className="px-4">Topic</th>
                                                            <th>Author</th>
                                                            <th className="text-center">Replies</th>
                                                            <th>Posted</th>
                                                            <th>Last Reply</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sectionPosts.map((post) => {
                                                            return (
                                                            <tr key={post.id}>
                                                                <td className="px-4">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        {post.isPinned === true && (
                                                                            <i className="bi bi-pin-angle-fill text-success" title="Pinned" style={{ fontSize: '1.1rem' }}></i>
                                                                        )}
                                                                        <Link
                                                                            href={`/forum/post/${post.id}`}
                                                                            className={`fw-medium ${post.isPinned === true ? 'text-success' : ''}`}
                                                                        >
                                                                            {post.title}
                                                                        </Link>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div>
                                                                        <Link href={`/user/${post.author?.id}/profile`}>
                                                                            {post.author?.username}
                                                                        </Link>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center">
                                                                    <span className="badge bg-primary rounded-pill">
                                                                        {post.repliesCount}
                                                                    </span>
                                                                </td>
             
                                                                <td>
                                                                    <div className="text-body-secondary">
                                                                        {format(new Date(post.createdAt), 'MMM d, yyyy')}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    {post.lastReply ? (
                                                                        <div className="small">
                                                                            <div>{format(new Date(post.lastReply.createdAt), 'MMM d, yyyy h:mm a')}</div>
                                                                            <div className="text-body-secondary">by {post.lastReply.author?.username}</div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="small">
                                                                            <div>{format(new Date(post.createdAt), 'MMM d, yyyy h:mm a')}</div>
                                                                            <div className="text-body-secondary">by {post.author?.username}</div>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}