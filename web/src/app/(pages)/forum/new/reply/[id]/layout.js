import { generateMetadata } from '../../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Reply',
  description: 'Reply to a post in the AlphaBlox Forum',
  path: '/forum/new/reply/[id]'
});

export default function ReplyLayout({ children }) {
  return children;
}