import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

/** Shown when a route throws, or when a lazy-loaded chunk fails (e.g. after a new deployment). */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <EmptyState
        icon={<TriangleAlert className="size-7 text-amber-500" aria-hidden />}
        title={notFound ? 'Page not found' : 'Something went wrong'}
        description={
          notFound
            ? 'The page you are looking for does not exist.'
            : 'An unexpected error occurred while loading this page. Reloading usually fixes it.'
        }
        action={
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              Go home
            </Button>
          </div>
        }
      />
    </div>
  );
}
