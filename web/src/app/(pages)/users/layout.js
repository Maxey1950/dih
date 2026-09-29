import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Users',
  description: 'View all users',
  path: '/users'
});

export default function UsersLayout({ children }) {
  return children;
}