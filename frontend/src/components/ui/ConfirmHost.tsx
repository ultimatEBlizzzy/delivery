import { useConfirmStore } from '@/store/confirm.store';
import { Button } from './Button';
import { Modal } from './Modal';

/** Mounted once at the app root; renders whatever `confirm()` asked for. */
export function ConfirmHost() {
  const options = useConfirmStore((s) => s.options);
  const answer = useConfirmStore((s) => s.answer);
  return (
    <Modal
      open={!!options}
      onClose={() => answer(false)}
      title={options?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => answer(false)}>
            {options?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={options?.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => answer(true)}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {options?.message && <div className="text-sm text-slate-600">{options.message}</div>}
    </Modal>
  );
}
