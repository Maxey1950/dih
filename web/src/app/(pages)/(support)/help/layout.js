import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Help',
  description: 'Help for AlphaBlox',
  path: '/help'
});

export default function HelpLayout({ children }) {
  return children;
}