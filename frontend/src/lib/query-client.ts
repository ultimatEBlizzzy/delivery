import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError, getErrorMessage } from './api-error';
import { toast } from '@/store/toast.store';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Skip the automatic error toast (the caller renders the error inline instead). */
      silent?: boolean;
      /** Success toast shown automatically. */
      successMessage?: string;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry client errors (4xx): the same request will fail the same way.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toast.error(getErrorMessage(error));
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage);
    },
  }),
});
