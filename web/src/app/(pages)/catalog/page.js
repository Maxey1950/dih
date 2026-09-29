import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Catalog', path: '/catalog' });

export default function Page() {
  return (
    <ComingSoon
      title="Catalog"
      icon="bi-bag"
      description="The catalog of hats, gear, shirts and pants is being rebuilt. Items will be available in a future update."
    />
  );
}
