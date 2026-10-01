import { BadRequestException } from '@nestjs/common';

/** Turns business-rule violations into the same structured 400 the ValidationPipe produces. */
export function badRequestFromProblems(problems: string[]): BadRequestException {
  return new BadRequestException({
    message: problems.join('; '),
    details: problems.map((m) => ({ messages: [m] })),
  });
}
