import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Terms of Service',
  description: 'Terms of Service for AlphaBlox',
  path: '/terms'
});

export default function TermsLayout({ children }) {
  return children;
}