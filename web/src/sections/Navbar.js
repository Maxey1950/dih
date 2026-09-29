'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FEATURES, economyApi, messagesApi, usersApi } from '../lib/api';
import { siteConfig } from '../../config/site';
import UserSubmenu from '../components/UserSubmenu';
import UserAvatar from '../components/UserAvatar';

function formatRemaining(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, logout } = useAuth();
    const [friendRequests, setFriendRequests] = useState(0);
    const [messages, setMessages] = useState(0);
    const [currency, setCurrency] = useState(0);
    const [nextAward, setNextAward] = useState(null);
    const [now, setNow] = useState(() => Date.now());

    // Badge counts and balance. Messages and economy arrive in later phases
    // (see FEATURES in lib/api.js); until then those badges stay at zero.
    const userId = user?.id;
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        usersApi.myFriendRequests()
            .then((d) => !cancelled && setFriendRequests(d?.requests?.length ?? 0))
            .catch(() => {});
        if (FEATURES.messages) {
            messagesApi.unreadCount()
                .then((d) => !cancelled && setMessages(d?.count ?? 0))
                .catch(() => {});
        }
        if (FEATURES.economy) {
            economyApi.balance()
                .then((d) => {
                    if (cancelled) return;
                    setCurrency(d?.currency ?? 0);
                    setNextAward(d?.nextAward ?? null);
                })
                .catch(() => {});
        }
        return () => { cancelled = true; };
    }, [userId, pathname]);

    useEffect(() => {
        if (!nextAward) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [nextAward]);

    const remaining = nextAward ? new Date(nextAward).getTime() - now : null;
    const canClaim = remaining !== null && remaining <= 0;
    const formattedTimeRemaining = remaining !== null && remaining > 0 ? formatRemaining(remaining) : null;

    const handleLogout = async () => {
        await logout();
        router.push('/login');
        router.refresh();
    };

    if (loading) {
        return null;
    }

    const friendRequestsBadge = friendRequests > 0 ? (
        <span className="badge bg-warning ms-2">{friendRequests}</span>
    ) : null;

    const messagesBadge = messages > 0 ? (
        <span className="badge bg-danger ms-2">{messages}</span>
    ) : null;

    return (
        <>
            <nav className="navbar navbar-expand-lg bg-primary bg-gradient">
                <div className="container-fluid">
                    <div className="row w-100 mx-0">
                        <div className="col-12 col-sm-12 col-md-12 col-lg-12 col-xl-10 offset-xl-1">
                            <div className="d-flex flex-wrap justify-content-between align-items-center">
                                <Link className="navbar-brand fw-bold text-body" href="/">
                                    <img src="/images/ValkLogo.png" alt={siteConfig.name} height="30" className="d-inline-block align-text-top me-2" />
                                </Link>

                                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent" aria-controls="navbarContent" aria-expanded="false" aria-label="Toggle navigation">
                                    <span className="navbar-toggler-icon"></span>
                                </button>

                                <div className="collapse navbar-collapse" id="navbarContent">
                                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/games' ? 'active fw-medium' : ''}`} href="/games">Games</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/catalog' ? 'active fw-medium' : ''}`} href="/catalog">Catalog</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/forum/home' ? 'active fw-medium' : ''}`} href="/forum/home">Forum</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/users' ? 'active fw-medium' : ''}`} href="/users">People</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/groups' ? 'active fw-medium' : ''}`} href="/groups">Groups</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/memberships' ? 'active fw-medium' : ''}`} href="/memberships">Memberships</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/blog' ? 'active fw-medium' : ''}`} href="/blog">Blog</Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className={`nav-link text-light ${pathname === '/parents' ? 'active fw-medium' : ''}`} href="/parents">Parents</Link>
                                        </li>
                                        <li className="nav-item dropdown">
                                            <a className="nav-link dropdown-toggle text-light" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                More
                                            </a>
                                            <ul className="dropdown-menu">
                                                {siteConfig.social.discord && (
                                                    <>
                                                        <li>
                                                            <a className="dropdown-item" href={siteConfig.social.discord} target="_blank" rel="noopener noreferrer">
                                                                Discord <i className="bi bi-box-arrow-up-right ms-1 small"></i>
                                                            </a>
                                                        </li>
                                                        <li><hr className="dropdown-divider"/></li>
                                                    </>
                                                )}
                                                <li>
                                                    <Link className={`dropdown-item ${pathname === '/help' ? 'active fw-medium' : ''}`} href="/help">Help</Link>
                                                </li>
                                                <li>
                                                    <Link className={`dropdown-item ${pathname === '/faq' ? 'active fw-medium' : ''}`} href="/faq">FAQ</Link>
                                                </li>
                                            </ul>
                                        </li>

                                        {/* UserSubmenu Links in Mobile Menu */}
                                        {user && (
                                            <>
                                                <li className="nav-item d-lg-none">
                                                    <hr className="dropdown-divider" />
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href={`/user/${user.id}/profile`}>
                                                        Profile
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/my/avatar">
                                                        Avatar
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href={`/user/${user.id}/friends`}>
                                                        Friends
                                                        {friendRequestsBadge}
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/my/messages">
                                                        Messages
                                                        {messagesBadge}
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/create">
                                                        Create
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/my/groups">
                                                        My Groups
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/money">
                                                        Money
                                                    </Link>
                                                </li>
                                                <li className="nav-item d-lg-none">
                                                    <Link className="nav-link text-light" href="/settings">
                                                        Account
                                                    </Link>
                                                </li>
                                            </>
                                        )}
                                    </ul>

                                    {/* Right Side Auth Buttons */}
                                    <div className="d-flex gap-2 align-items-center">
                                        {user ? (
                                            <div className="d-flex align-items-center">
                                                {/* Currency Display */}
                                                <div className="d-flex align-items-center me-3">
                                                    <div
                                                        className="d-flex align-items-center cursor-pointer"
                                                        title={canClaim ? 'Currency available now!' : formattedTimeRemaining ? `Next reward in: ${formattedTimeRemaining}` : undefined}
                                                    >
                                                        <i className="bi bi-coin text-warning me-1"></i>
                                                        <span className={`text-light ${canClaim ? 'text-success fw-bold' : ''}`}>{currency}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="d-flex align-items-center me-4">
                                                    <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px", overflow: "hidden" }}>
                                                        <UserAvatar
                                                            userId={user.id}
                                                            alt="Profile"
                                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                        />
                                                    </div>
                                                    <span className="ms-2 fw-medium text-light">{user.username}</span>
                                                </div>
                                                <div className="dropdown">
                                                    <button className="btn btn-outline-light btn-sm rounded-circle" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                                        <i className="bi bi-three-dots-vertical"></i>
                                                    </button>
                                                    <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" aria-labelledby="userDropdown" style={{ minWidth: '200px' }}>
                                                        <li className="px-3 py-1 text-body-secondary small">ACCOUNT</li>
                                                        <li><Link className="dropdown-item py-2" href="/money">
                                                            <i className="bi bi-coin me-2 text-warning"></i>
                                                        Currency: {currency}
                                                        {formattedTimeRemaining && (
                                                            <small className="d-block text-muted ms-4 mt-1">Next reward in: {formattedTimeRemaining}</small>
                                                        )}
                                                        {canClaim && (
                                                            <small className="d-block text-success ms-4 mt-1">Currency available now!</small>
                                                        )}
                                                        </Link></li>
                                                        <li><Link className="dropdown-item py-2" href="/settings">
                                                            <i className="bi bi-gear me-2 text-primary"></i>Settings
                                                        </Link></li>
                                                        <li><hr className="dropdown-divider" /></li>
                                                        <li className="px-3 py-1 text-body-secondary small">OTHER</li>
                                                        <li><Link className="dropdown-item py-2" href="/help">
                                                            <i className="bi bi-question-circle me-2 text-primary"></i>Help Center
                                                        </Link></li>
                                                        <li><hr className="dropdown-divider" /></li>
                                                        <li><button className="dropdown-item py-2 text-danger" onClick={handleLogout}>
                                                            <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                                                        </button></li>
                                                    </ul>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Link href="/login" className={`btn ${pathname === '/login' ? 'btn-light' : 'btn-success'}`}>Login</Link>
                                                <Link href="/signup" className={`btn ${pathname === '/signup' ? 'btn-light' : 'btn-success'}`}>Sign Up</Link>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            {user && <UserSubmenu username={user.username} userId={user.id} friendRequests={friendRequests} messages={messages} />}
        </>
    );
}