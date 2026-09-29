/**
 * Plain-text helpers for user-generated content.
 *
 * User content is stored and rendered as plain text. It is never parsed as
 * HTML: links are produced as React elements from a tokenizer, so there is
 * no dangerouslySetInnerHTML and no sanitizer to keep up to date.
 */

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
// Trailing punctuation that usually belongs to the sentence, not the URL.
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

/**
 * Split text into `{ type: 'text' | 'link', value }` tokens.
 * Only http(s) URLs that parse with the URL constructor become links.
 */
export function tokenizeLinks(text) {
  if (!text) return [];
  const tokens = [];
  let lastIndex = 0;

  for (const match of String(text).matchAll(URL_PATTERN)) {
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? '';
    if (trailing) url = url.slice(0, -trailing.length);

    if (match.index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    tokens.push(isSafeHttpUrl(url) ? { type: 'link', value: url } : { type: 'text', value: url });
    if (trailing) tokens.push({ type: 'text', value: trailing });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) });
  return tokens;
}

export function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
