import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Contact',
  description: 'Contact AlphaBlox',
  path: '/contact'
});

export default function ContactLayout({ children }) {
  return children;
}