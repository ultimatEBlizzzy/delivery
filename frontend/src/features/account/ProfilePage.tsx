import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogOut, Save } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { authApi } from '@/api/auth';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, PasswordInput } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError, getErrorMessage } from '@/lib/api-error';
import { confirm } from '@/store/confirm.store';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordForm,
  type ProfileForm,
} from '../auth/schemas';
import { signOut } from '../auth/session';
import { useNavigate } from 'react-router-dom';
import { PORTAL_LOGIN } from '../auth/session';
import type { Role } from '@hardware-delivery/shared';

/** Profile + security settings, shared by all four portals. */
export function ProfilePage({ portal, children }: { portal: Role; children?: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)!;
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' },
  });
  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const updateProfile = useMutation({
    mutationFn: authApi.updateProfile,
    meta: { successMessage: 'Profile updated' },
    onSuccess: (updated) => {
      setUser(updated);
      profileForm.reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone ?? '',
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in profileForm.getValues())
            profileForm.setError(field as keyof ProfileForm, { message });
        }
      }
    },
  });

  const changePassword = useMutation({
    mutationFn: authApi.changePassword,
    meta: { silent: true },
  });

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success(
        'Password changed. You have been signed out everywhere – please sign in again.',
      );
      await signOut();
      navigate(PORTAL_LOGIN[portal], { replace: true });
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My profile" description="Your personal details and account security." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Personal details" description={user.email} />
          <CardBody>
            <form
              onSubmit={profileForm.handleSubmit((v) =>
                updateProfile.mutate({
                  firstName: v.firstName,
                  lastName: v.lastName,
                  phone: v.phone || undefined,
                }),
              )}
              noValidate
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  autoComplete="given-name"
                  required
                  error={profileForm.formState.errors.firstName?.message}
                  {...profileForm.register('firstName')}
                />
                <Input
                  label="Last name"
                  autoComplete="family-name"
                  required
                  error={profileForm.formState.errors.lastName?.message}
                  {...profileForm.register('lastName')}
                />
              </div>
              <Input
                label="Email address"
                value={user.email}
                disabled
                readOnly
                hint="Your email is your sign-in name and can’t be changed here."
              />
              <Input
                label="Mobile number"
                type="tel"
                autoComplete="tel"
                placeholder="082 123 4567"
                error={profileForm.formState.errors.phone?.message}
                {...profileForm.register('phone')}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={updateProfile.isPending}
                  disabled={!profileForm.formState.isDirty}
                  leftIcon={<Save className="size-4" aria-hidden />}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {children}

        <Card>
          <CardHeader
            title="Security"
            description="Change your password. You will be signed out on all devices."
          />
          <CardBody>
            <form onSubmit={onChangePassword} noValidate className="space-y-4">
              {passwordError && <Alert>{passwordError}</Alert>}
              <PasswordInput
                label="Current password"
                autoComplete="current-password"
                required
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  required
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register('newPassword')}
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  required
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword')}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="outline"
                  leftIcon={<LogOut className="size-4" aria-hidden />}
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: 'Sign out of all devices?',
                        message:
                          'You will need to sign in again everywhere, including this device.',
                        confirmLabel: 'Sign out everywhere',
                      }))
                    )
                      return;
                    await authApi.logoutAll().catch(() => undefined);
                    await signOut();
                    navigate(PORTAL_LOGIN[portal], { replace: true });
                  }}
                >
                  Sign out everywhere
                </Button>
                <Button type="submit" loading={changePassword.isPending}>
                  Change password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
