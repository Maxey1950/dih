import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Post',
  description: 'View a post in the AlphaBlox Forum',
  path: '/forum/post/[id]'
});

export default function PostLayout({ children }) {
  return children;
}