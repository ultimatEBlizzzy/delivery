import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema, registerSchema } from './schemas';

const validRegistration = {
  firstName: 'Thandi',
  lastName: 'Mokoena',
  email: 'thandi@example.com',
  phone: '082 123 4567',
  password: 'Str0ngPassw0rd',
  confirmPassword: 'Str0ngPassw0rd',
  acceptTerms: true,
};

describe('auth schemas', () => {
  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
    expect(registerSchema.safeParse({ ...validRegistration, phone: '' }).success).toBe(true); // phone optional
  });

  it.each([
    ['weak password', { password: 'password', confirmPassword: 'password' }, 'password'],
    ['short password', { password: 'Ab1', confirmPassword: 'Ab1' }, 'password'],
    ['mismatched confirmation', { confirmPassword: 'Different1' }, 'confirmPassword'],
    ['invalid email', { email: 'nope' }, 'email'],
    ['missing first name', { firstName: '  ' }, 'firstName'],
    ['bad phone', { phone: '12345' }, 'phone'],
    ['terms not accepted', { acceptTerms: false }, 'acceptTerms'],
  ])('rejects %s', (_label, patch, field) => {
    const result = registerSchema.safeParse({ ...validRegistration, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === field)).toBe(true);
  });

  it('validates login input', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('requires matching, policy-compliant new passwords', () => {
    const ok = {
      currentPassword: 'Old12345',
      newPassword: 'N3wPassw0rd',
      confirmPassword: 'N3wPassw0rd',
    };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'nope' }).success).toBe(false);
    expect(
      changePasswordSchema.safeParse({ ...ok, newPassword: 'weak', confirmPassword: 'weak' })
        .success,
    ).toBe(false);
  });
});
