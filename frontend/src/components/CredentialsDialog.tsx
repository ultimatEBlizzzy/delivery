import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** Shows generated sign-in details exactly once (the server never stores or re-sends the password). */
export function CredentialsDialog({
  credentials,
  onClose,
  who = 'the new user',
}: {
  credentials: { email: string; temporaryPassword: string } | null;
  onClose: () => void;
  who?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = credentials
    ? `Email: ${credentials.email}\nTemporary password: ${credentials.temporaryPassword}`
    : '';
  return (
    <Modal
      open={!!credentials}
      onClose={onClose}
      size="sm"
      title="Share these sign-in details"
      footer={
        <>
          <Button
            variant="outline"
            leftIcon={
              copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )
            }
            onClick={async () => {
              await navigator.clipboard?.writeText(text).catch(() => undefined);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <Alert tone="warning" title="This password is shown only once">
        Send it to {who} securely and ask them to change it after signing in (open Profile, then
        Security).
      </Alert>
      {credentials && (
        <dl className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-mono text-slate-900">{credentials.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Temporary password</dt>
            <dd className="select-all font-mono text-base font-semibold text-slate-900">
              {credentials.temporaryPassword}
            </dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
