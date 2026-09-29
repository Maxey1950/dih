import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Forgot Password',
  description: 'Reset your password here',
  path: '/forgot-password'
});

export default function LoginLayout({ children }) {
  return children;
}