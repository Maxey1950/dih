import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Groups',
  description: 'Groups',
  path: '/my/groups'
});

export default function GroupsLayout({ children }) {
  return children;
}