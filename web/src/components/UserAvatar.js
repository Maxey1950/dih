import { DEFAULT_AVATAR } from '../../config/site';

/**
 * Avatar image for a user.
 *
 * Phase 1: always the bundled default avatar. When the thumbnail service
 * exists, switch `src` to avatarThumbnailUrl(userId, size) from lib/api.js.
 * Never render a user-supplied image URL here.
 */
export default function UserAvatar({ userId, alt = '', size, className = '', style }) {
  return (
    <img
      src={DEFAULT_AVATAR}
      alt={alt}
      className={className}
      style={size ? { width: size, height: size, ...style } : style}
    />
  );
}
