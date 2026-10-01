import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  answer: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false); // settle any dialog that is still open
      set({ options, resolve });
    }),
  answer: (value) => {
    get().resolve?.(value);
    set({ options: null, resolve: null });
  },
}));

/** `if (await confirm({ title: 'Delete?' })) …` – promise-based confirmation dialog. */
export const confirm = (options: ConfirmOptions) => useConfirmStore.getState().ask(options);
