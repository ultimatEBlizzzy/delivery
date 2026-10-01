import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Input';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { AuthShell } from './AuthShell';
import { registerSchema, type RegisterForm } from './schemas';

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const mutation = useMutation({ mutationFn: authApi.register, meta: { silent: true } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await mutation.mutateAsync({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
      });
      useAuthStore.getState().setSession(res);
      navigate(from && from.startsWith('/') && !from.startsWith('//') ? from : '/', {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // Map server-side validation errors back onto the matching fields.
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in values) setError(field as keyof RegisterForm, { message });
        }
      }
      setFormError(getErrorMessage(err));
    }
  });

  return (
    <AuthShell
      portal="customer"
      title="Create your account"
      subtitle="Order hardware from local stores and have it delivered."
      footer={
        <p>
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-brand-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert title="We couldn’t create your account">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="given-name"
            required
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            required
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="082 123 4567"
          hint="Optional – lets drivers contact you about your delivery."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          required
          hint="At least 8 characters with upper-case, lower-case and a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Checkbox
          label="I agree to the terms of use and privacy policy"
          error={errors.acceptTerms?.message}
          {...register('acceptTerms')}
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={mutation.isPending}
          leftIcon={<UserPlus className="size-5" aria-hidden />}
        >
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
