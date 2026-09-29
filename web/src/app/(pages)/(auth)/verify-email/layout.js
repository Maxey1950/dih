import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Verify Email',
  description: 'Verify your email address',
  path: '/verify-email'
});

export default function VerifyEmailLayout({ children }) {
  return children;
}