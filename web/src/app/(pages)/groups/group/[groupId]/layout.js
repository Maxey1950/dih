import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Group',
  description: 'Group',
  path: '/my/groups/group/[groupId]'
});

export default function GroupLayout({ children }) {
  return children;
}