import ComingSoon from '../../../components/ComingSoon';
import { generateMetadata } from '../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Money', path: '/money' });

export default function Page() {
  return (
    <ComingSoon
      title="Money"
      icon="bi-wallet2"
      description="Currency, transactions and trades are not available yet."
    />
  );
}
