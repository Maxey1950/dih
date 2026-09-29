import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Parents', path: '/parents' });

export default function Page() {
  return (
    <ComingSoon
      title="Parents"
      icon="bi-shield-check"
      description="Information for parents is being written. See the Safety page in the meantime."
    />
  );
}
