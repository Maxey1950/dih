import { generateMetadata } from '../../../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Reply to Message',
  description: 'Reply to a message',
  path: '/my/messages/reply/[id]'
});

export default function ReplyMessageLayout({ children }) {
  return children;
}