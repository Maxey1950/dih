import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Reset Password',
  description: 'Reset your password',
  path: '/reset-password'
});

export default function ResetPasswordLayout({ children }) {
  return children;
}