/**
 * The only way the web app talks to the backend.
 *
 * - Every request goes to a same-origin, relative `/api/...` path. Absolute
 *   URLs, protocol-relative URLs (`//host`) and anything outside `/api/` are
 *   rejected, so credentials can never be sent to another domain.
 * - Authentication is a server-issued HttpOnly session cookie. JavaScript
 *   never sees, stores or forwards a token; the browser attaches the cookie
 *   itself because the request is same-origin.
 * - Endpoint paths follow docs/alphablox-migration-map.md ("Replacement API
 *   map"). Most of them are not implemented by api/ yet and will return
 *   404 until their phase lands; pages must handle ApiError gracefully.
 */

const CLIENT_HEADER = 'X-Revival-Client';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertApiPath(path) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/api/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    throw new ApiError('Refusing to call a non-API or cross-origin URL', { code: 'INVALID_API_PATH' });
  }
}

function withQuery(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Encode a single dynamic path segment (ids, usernames). */
export const seg = (value) => encodeURIComponent(String(value));

async function request(method, path, { body, query, signal } = {}) {
  assertApiPath(path);

  const headers = { Accept: 'application/json', [CLIENT_HEADER]: 'web' };
  const init = {
    method,
    headers,
    // Same-origin only: the session cookie is sent, and can never be sent elsewhere.
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(withQuery(path, query), init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Unable to reach the server. Please try again.', { code: 'NETWORK_ERROR' });
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(error?.message || defaultMessage(response.status), {
      status: response.status,
      code: error?.code || `HTTP_${response.status}`,
      details: error?.details,
    });
  }
  return data;
}

function defaultMessage(status) {
  switch (status) {
    case 401:
      return 'Please log in to continue.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'This feature is not available yet.';
    case 429:
      return 'Too many requests. Please slow down.';
    default:
      return status >= 500 ? 'Server error. Please try again later.' : 'Request failed.';
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
};

/** Human-readable message for any thrown value. */
export function errorMessage(err, fallback = 'Something went wrong.') {
  if (err instanceof ApiError) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Resource functions. Keep every endpoint path in this file.
// ---------------------------------------------------------------------------

export const authApi = {
  /** @returns {Promise<{authenticated: boolean, user: object|null}>} */
  me: (opts) => api.get('/api/auth/me', opts),
  login: ({ username, password }) => api.post('/api/auth/login', { username, password }),
  logout: () => api.post('/api/auth/logout', {}),
  register: ({ username, email, password }) => api.post('/api/auth/register', { username, email, password }),
  verifyEmail: (token) => api.post('/api/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/api/auth/verify-email/resend', { email }),
  forgotPassword: (email) => api.post('/api/auth/password/forgot', { email }),
  resetPassword: ({ token, newPassword }) => api.post('/api/auth/password/reset', { token, newPassword }),
  changePassword: ({ currentPassword, newPassword }) =>
    api.post('/api/auth/password/change', { currentPassword, newPassword }),
};

export const usersApi = {
  list: ({ query, page, limit } = {}) => api.get('/api/users', { query: { query, page, limit } }),
  get: (id) => api.get(`/api/users/${seg(id)}`),
  updateMe: (patch) => api.patch('/api/users/me', patch),
  mySettings: () => api.get('/api/users/me/settings'),
  friends: (id) => api.get(`/api/users/${seg(id)}/friends`),
  myFriendRequests: () => api.get('/api/users/me/friend-requests'),
  sendFriendRequest: (id) => api.post(`/api/users/${seg(id)}/friend-request`, {}),
  unfriend: (id) => api.delete(`/api/users/${seg(id)}/friend`),
  follow: (id) => api.post(`/api/users/${seg(id)}/follow`, {}),
  unfollow: (id) => api.delete(`/api/users/${seg(id)}/follow`),
  followers: (id) => api.get(`/api/users/${seg(id)}/followers`),
  following: (id) => api.get(`/api/users/${seg(id)}/following`),
  myGroups: () => api.get('/api/users/me/groups'),
};

export const friendRequestsApi = {
  accept: (requestId) => api.post(`/api/friend-requests/${seg(requestId)}/accept`, {}),
  decline: (requestId) => api.post(`/api/friend-requests/${seg(requestId)}/decline`, {}),
};

export const economyApi = {
  balance: () => api.get('/api/economy/balance'),
};

export const messagesApi = {
  list: ({ box, page } = {}) => api.get('/api/messages', { query: { box, page } }),
  get: (id) => api.get(`/api/messages/${seg(id)}`),
  unreadCount: () => api.get('/api/messages/unread-count'),
  send: ({ recipientId, subject, content }) => api.post('/api/messages', { recipientId, subject, content }),
  /** patch: { isRead?: boolean, isArchived?: boolean } */
  update: (id, patch) => api.patch(`/api/messages/${seg(id)}`, patch),
};

export const groupsApi = {
  list: ({ query, page } = {}) => api.get('/api/groups', { query: { query, page } }),
  get: (id) => api.get(`/api/groups/${seg(id)}`),
  create: ({ name, description, isPublic }) => api.post('/api/groups', { name, description, isPublic }),
  update: (id, { name, description, isPublic }) => api.patch(`/api/groups/${seg(id)}`, { name, description, isPublic }),
  join: (id) => api.post(`/api/groups/${seg(id)}/membership`, {}),
  leave: (id) => api.delete(`/api/groups/${seg(id)}/membership`),
  removeMember: (id, userId) => api.delete(`/api/groups/${seg(id)}/members/${seg(userId)}`),
};

export const forumApi = {
  listThreads: ({ section, page } = {}) => api.get('/api/forum/threads', { query: { section, page } }),
  getThread: (id) => api.get(`/api/forum/threads/${seg(id)}`),
  createThread: ({ title, section, content }) => api.post('/api/forum/threads', { title, section, content }),
  reply: (id, content) => api.post(`/api/forum/threads/${seg(id)}/replies`, { content }),
  moderate: (id, { locked, pinned }) => api.patch(`/api/forum/threads/${seg(id)}`, { locked, pinned }),
};

export const reportsApi = {
  /** targetType: 'user' | 'forum_thread' | 'forum_reply' | 'game' | 'item' */
  create: ({ targetType, targetId, reason, details }) =>
    api.post('/api/reports', { targetType, targetId, reason, details }),
};

export const adminApi = {
  users: ({ query, page } = {}) => api.get('/api/admin/users', { query: { query, page } }),
  ban: (userId, { reason, expiresAt }) => api.post(`/api/admin/users/${seg(userId)}/ban`, { reason, expiresAt }),
  unban: (userId) => api.delete(`/api/admin/users/${seg(userId)}/ban`),
  setRole: (userId, role) => api.put(`/api/admin/users/${seg(userId)}/role`, { role }),
  reports: ({ type, status } = {}) => api.get('/api/admin/reports', { query: { type, status } }),
  updateReport: (id, { status }) => api.patch(`/api/admin/reports/${seg(id)}`, { status }),
};

/** Avatar thumbnails are served by our own API; never by a user-supplied URL. */
export const avatarThumbnailUrl = (userId, size = 150) =>
  `/api/thumbnails/avatar/${seg(userId)}?size=${encodeURIComponent(size)}`;
