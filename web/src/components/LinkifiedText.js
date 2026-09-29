import { tokenizeLinks } from '../lib/utils/textHelper';

/**
 * Renders user-written text with http(s) links made clickable.
 * Everything is a React text node or <a>; no HTML from the user is ever
 * interpreted. Line breaks are preserved by the caller's `white-space: pre-wrap`.
 */
export default function LinkifiedText({ text }) {
  return tokenizeLinks(text).map((token, i) =>
    token.type === 'link' ? (
      <a key={i} href={token.value} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary">
        {token.value}
      </a>
    ) : (
      <span key={i}>{token.value}</span>
    )
  );
}
