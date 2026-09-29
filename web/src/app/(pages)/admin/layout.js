import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Admin Dashboard',
  description: 'Manage users and system settings',
  path: '/admin'
});

export default function AdminLayout({ children }) {
  return children;
}