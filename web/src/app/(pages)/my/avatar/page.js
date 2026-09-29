import ComingSoon from '../../../../components/ComingSoon';
import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Avatar', path: '/my/avatar' });

export default function Page() {
  return (
    <ComingSoon
      title="Avatar"
      icon="bi-person-bounding-box"
      description="The avatar editor is not available yet. Your character will be customizable in a future update."
    />
  );
}
