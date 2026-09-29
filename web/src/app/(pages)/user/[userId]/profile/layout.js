import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Profile',
  description: 'View your profile',
  path: '/profile'
});

export default function ProfileLayout({ children }) {
  return children;
}