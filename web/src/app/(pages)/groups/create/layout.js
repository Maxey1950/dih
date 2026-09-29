import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Create Group',
  description: 'Create Group',
  path: '/my/groups/create'
});

export default function CreateGroupLayout({ children }) {
  return children;
}