import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<Compass className="size-7" aria-hidden />}
        title="We can’t find that page"
        description="The link may be broken or the page may have moved."
        action={
          <Link to="/" className={buttonClasses()}>
            Back to home
          </Link>
        }
      />
    </div>
  );
}
