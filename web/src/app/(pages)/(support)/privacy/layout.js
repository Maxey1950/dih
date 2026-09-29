import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Privacy Policy',
  description: 'Privacy Policy for AlphaBlox',
  path: '/privacy'
});

export default function PrivacyLayout({ children }) {
  return children;
}