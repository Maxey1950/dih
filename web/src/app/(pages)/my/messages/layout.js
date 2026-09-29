import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Messages',
  description: 'Messages',
  path: '/my/messages'
});

export default function MessagesLayout({ children }) {
  return children;
}