import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Forum',
  description: 'The place to discuss anything and everything about AlphaBlox',
  path: '/forum'
});

export default function ForumLayout({ children }) {
  return children;
}