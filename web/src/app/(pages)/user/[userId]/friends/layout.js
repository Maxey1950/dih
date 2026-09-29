import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Friends',
  description: 'View your friends',
  path: '/friends'
});

export default function FriendsLayout({ children }) {
  return children;
}