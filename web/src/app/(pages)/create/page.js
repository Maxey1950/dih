import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Create', path: '/create' });

export default function Page() {
  return (
    <ComingSoon
      title="Create"
      icon="bi-plus-square"
      description="Creating and uploading places is not available yet."
    />
  );
}
