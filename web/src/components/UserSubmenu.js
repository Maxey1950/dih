"use client";

import Link from "next/link";

export default function UserSubmenu({ username, userId, friendRequests, messages }) {
return (
    <div className="bg-secondary border-bottom d-none d-lg-block">
        <div className="container-fluid">
            <div className="row w-100 mx-0">
                <div className="col-12 col-sm-12 col-md-12 col-lg-12 col-xl-10 offset-xl-1">
                    <div className="d-flex align-items-center py-2">

                        {/* Navigation Links */}
                        <div className="d-flex gap-4">
                            <Link href={`/user/${userId}/profile`} className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="bi bi-person me-1"></i>
                                <span>Profile</span>
                            </Link>
                            <Link href="/my/avatar" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="fa-solid fa-shirt me-1"></i>
                                <span>Avatar</span>
                            </Link>
                            <Link href={`/user/${userId}/friends`} className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="bi bi-people me-1"></i>
                                <span>Friends</span>
                                {friendRequests > 0 && (
                                    <span className="badge bg-warning ms-1">{friendRequests}</span>
                                )}
                            </Link>
                            <Link href="/my/messages" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="bi bi-envelope me-1"></i>
                                <span>Messages</span>
                                {messages > 0 && (
                                    <span className="badge bg-danger ms-1">{messages}</span>
                                )}
                            </Link>
                            <Link href="/create" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="fa-solid fa-plus me-1"></i>
                                <span>Create</span>
                            </Link>
                            <Link href="/my/groups" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="fa-solid bi-people-fill me-1"></i>
                                <span>Groups</span>
                            </Link>
                            <Link href="/money" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="fa-solid bi-wallet2 me-1"></i>
                                <span>Money</span>
                            </Link>
                            <Link href="/settings" className="small text-decoration-none text-light d-flex align-items-center">
                                <i className="fa-solid bi-gear me-1"></i>
                                <span>Account</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
