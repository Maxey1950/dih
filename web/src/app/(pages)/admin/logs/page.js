import ComingSoon from '../../../../components/ComingSoon';
import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({ title: 'Admin Logs', path: '/admin/logs' });

export default function Page() {
  return (
    <ComingSoon
      title="Admin Logs"
      icon="bi-journal-text"
      description="The admin audit log will be available once admin actions are implemented."
    />
  );
}
