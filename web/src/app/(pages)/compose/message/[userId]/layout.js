import { generateMetadata } from '../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Compose Message',
  description: 'Compose a message',
  path: '/compose/message'
});

export default function ComposeMessageLayout({ children }) {
  return children;
}