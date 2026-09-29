import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Sign Up',
  description: 'Create your AlphaBlox account and join our community',
  path: '/signup'
});

export default function SignupLayout({ children }) {
  return children;
}