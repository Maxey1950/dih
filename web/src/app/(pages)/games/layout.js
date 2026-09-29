import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Games',
  description: 'Discover unique games on AlphaBlox',
  path: '/games'
});

export default function HomeLayout({ children }) {
  return children;
}