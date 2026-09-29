import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Login',
  description: 'Login to your AlphaBlox account',
  path: '/login'
});

export default function LoginLayout({ children }) {
  return children;
}