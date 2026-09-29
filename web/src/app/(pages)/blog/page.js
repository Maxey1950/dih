import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Blog', path: '/blog' });

export default function Page() {
  return (
    <ComingSoon
      title="Blog"
      icon="bi-newspaper"
      description="The blog is not available yet. Announcements are posted on the forum."
    />
  );
}
