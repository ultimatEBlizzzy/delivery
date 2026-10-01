import { registerDecorator, ValidationOptions } from 'class-validator';
import { validateOperatingHours } from '@hardware-delivery/shared';

/** Validates a weekly opening-hours object (mon..sun, each with closed/open/close). */
export function IsOperatingHours(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isOperatingHours',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => validateOperatingHours(value) === null,
        defaultMessage: (args) => validateOperatingHours(args?.value) ?? 'Invalid operating hours',
      },
    });
}
