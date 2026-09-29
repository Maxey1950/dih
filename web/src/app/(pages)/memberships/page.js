import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Memberships', path: '/memberships' });

export default function Page() {
  return (
    <ComingSoon
      title="Memberships"
      icon="bi-award"
      description="Memberships are not available yet."
    />
  );
}
