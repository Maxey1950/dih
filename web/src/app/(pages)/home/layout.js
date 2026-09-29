import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Home',
  description: 'Your personal home page and activity feed',
  path: '/home'
});

export default function HomeLayout({ children }) {
  return children;
}