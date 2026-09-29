import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'New Post',
  description: 'Create a new post in the AlphaBlox Forum',
  path: '/forum/new/post'
});

export default function NewPostLayout({ children }) {
  return children;
}