import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Settings',
  description: 'Manage your AlphaBlox account settings',
  path: '/settings'
});

export default function SettingsLayout({ children }) {
  return children;
}