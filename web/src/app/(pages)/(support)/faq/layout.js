import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'FAQ',
  description: 'Frequently Asked Questions for ValkAlphaBloxyrie',
  path: '/faq'
});

export default function FAQLayout({ children }) {
  return children;
}