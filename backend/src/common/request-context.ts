import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  userEmail?: string;
  roles?: string[];
}

const storage = new AsyncLocalStorage<RequestContextData>();

/**
 * Per-request context available anywhere in the call stack without threading `req` through
 * every service (used by audit logging and by log/error correlation).
 */
export const RequestContext = {
  run<T>(data: RequestContextData, fn: () => T): T {
    return storage.run(data, fn);
  },
  get(): RequestContextData | undefined {
    return storage.getStore();
  },
  set(partial: Partial<RequestContextData>): void {
    const store = storage.getStore();
    if (store) Object.assign(store, partial);
  },
};
