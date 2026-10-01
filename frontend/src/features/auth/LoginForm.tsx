import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, Role } from '@hardware-delivery/shared';
import { authApi } from '@/api/auth';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Input, PasswordInput } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema, type LoginForm as LoginValues } from './schemas';
import { PORTAL_LOGIN, ROLE_HOME } from './session';

const PORTAL_NAMES: Record<Role, string> = {
  [Role.CUSTOMER]: 'customer app',
  [Role.DRIVER]: 'driver portal',
  [Role.STORE]: 'store portal',
  [Role.ADMIN]: 'admin console',
};

/** Only allow same-site relative redirects (prevents open-redirect abuse of `state.from`). */
const safePath = (p: unknown): string | null =>
  typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : null;

const showDemoAccounts = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

export function LoginForm({
  role,
  registerPath,
  forgotHint,
}: {
  role: Role;
  registerPath?: string;
  forgotHint?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = safePath((location.state as { from?: string } | null)?.from);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({ mutationFn: authApi.login, meta: { silent: true } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await login.mutateAsync(values);
      if (!res.user.roles.includes(role)) {
        await authApi.logout().catch(() => undefined); // revoke the refresh cookie that was just issued
        const own = res.user.roles[0];
        setFormError(
          `This account can't use the ${PORTAL_NAMES[role]}.` +
            (own ? ` Sign in at ${PORTAL_LOGIN[own]} instead.` : ''),
        );
        return;
      }
      useAuthStore.getState().setSession(res);
      navigate(from ?? ROLE_HOME[role], { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  });

  const demos = DEMO_ACCOUNTS[role as keyof typeof DEMO_ACCOUNTS] ?? [];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert title="Couldn’t sign you in">{formError}</Alert>}
      <Input
        label="Email address"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoFocus
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      {forgotHint && (
        <p className="text-sm text-slate-500">
          Forgot your password? Ask a platform administrator to help you recover your account.
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={login.isPending}
        leftIcon={<LogIn className="size-5" aria-hidden />}
      >
        Sign in
      </Button>
      {registerPath && (
        <p className="text-center text-sm text-slate-600">
          New here?{' '}
          <Link to={registerPath} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      )}

      {showDemoAccounts && demos.length > 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <button
            type="button"
            onClick={() => setDemoOpen((o) => !o)}
            aria-expanded={demoOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
          >
            Demo accounts (seeded sample data)
            <ChevronDown
              className={`size-4 transition-transform ${demoOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {demoOpen && (
            <ul className="space-y-1 border-t border-slate-200 p-2">
              {demos.map((d) => (
                <li key={d.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue('email', d.email, { shouldValidate: true });
                      setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white"
                  >
                    <span className="font-medium text-slate-800">{d.label}</span>
                    <span className="truncate text-xs text-slate-500">
                      {d.description ?? d.email}
                    </span>
                  </button>
                </li>
              ))}
              <li className="px-3 pb-1 pt-2 text-xs text-slate-500">
                Click an account to fill the form, then press “Sign in”. Password:{' '}
                <code className="rounded bg-white px-1 py-0.5">{DEMO_PASSWORD}</code>
              </li>
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
