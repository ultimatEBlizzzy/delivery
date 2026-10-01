import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  hideLabel?: boolean;
  children: ReactNode;
}

/** Label + control + hint/error wiring shared by every form control. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  hideLabel,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn('text-sm font-medium text-slate-700', hideLabel && 'sr-only')}
        >
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlBase =
  'block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors ' +
  'focus:border-brand-500 focus:outline-2 focus:outline-brand-500/30 focus:outline-offset-0 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const controlState = (error?: string) => (error ? 'border-red-400' : 'border-slate-300');
const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface CommonFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
  wrapperClassName?: string;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, CommonFieldProps {
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  hint,
  error,
  hideLabel,
  wrapperClassName,
  leftIcon,
  rightElement,
  className,
  id: idProp,
  required,
  ref,
  ...rest
}: InputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={wrapperClassName}
    >
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(
            controlBase,
            'h-10',
            controlState(error),
            leftIcon && 'pl-10',
            rightElement && 'pr-11',
            className,
          )}
          {...rest}
        />
        {rightElement && (
          <span className="absolute inset-y-0 right-1.5 flex items-center">{rightElement}</span>
        )}
      </div>
    </FieldShell>
  );
}

export function PasswordInput(props: Omit<InputProps, 'type' | 'rightElement'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      }
    />
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, CommonFieldProps {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hint,
  error,
  hideLabel,
  wrapperClassName,
  className,
  id: idProp,
  required,
  rows = 3,
  ref,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlBase, 'py-2', controlState(error), className)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, CommonFieldProps {
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  label,
  hint,
  error,
  hideLabel,
  wrapperClassName,
  className,
  id: idProp,
  required,
  children,
  ref,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={wrapperClassName}
    >
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlBase, 'h-10 pr-8', controlState(error), className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({
  label,
  hint,
  error,
  className,
  id: idProp,
  ref,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700"
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
          {...rest}
        />
        <span>
          {label}
          {hint && <span className="block text-slate-500">{hint}</span>}
        </span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'lg';
}

/** Accessible on/off toggle (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
  size = 'md',
}: SwitchProps) {
  const lg = size === 'lg';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        lg ? 'h-9 w-16' : 'h-6 w-11',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow transition-transform',
          lg ? 'size-7' : 'size-5',
          checked ? (lg ? 'translate-x-8' : 'translate-x-[22px]') : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
