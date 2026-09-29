import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Safety',
  description: 'Safety for AlphaBlox',
  path: '/safety'
});

export default function SafetyLayout({ children }) {
  return children;
}