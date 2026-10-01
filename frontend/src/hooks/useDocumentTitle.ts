import { useEffect } from 'react';
import { env } from '@/env';

/** Sets the browser tab title (also announced by screen readers on navigation). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${env.appName}` : `${env.appName} – Hardware delivered`;
  }, [title]);
}
