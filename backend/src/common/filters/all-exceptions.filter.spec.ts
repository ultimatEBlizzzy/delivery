import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter, validationExceptionFactory } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent: false }),
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x?y=1', url: '/api/v1/x' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
}

const pgError = (code: string) =>
  new QueryFailedError('SELECT 1', [], Object.assign(new Error('boom'), { code }));

describe('AllExceptionsFilter', () => {
  it('keeps HttpException status and message, and adds path/timestamp', () => {
    const { status, body } = run(new ForbiddenException('nope'));
    expect(status).toBe(403);
    expect(body).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
      message: 'nope',
      path: '/api/v1/x',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('translates database errors into safe HTTP errors', () => {
    expect(run(pgError('23505')).status).toBe(409);
    expect(run(pgError('23503')).status).toBe(409);
    expect(run(pgError('23514')).status).toBe(400);
    expect(run(pgError('22P02')).status).toBe(400);
    expect(run(pgError('40001')).status).toBe(409);
  });

  it('never leaks internals for unexpected errors', () => {
    const { status, body } = run(new Error('password=hunter2 at /srv/app/secret.ts'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/hunter2|secret\.ts/);
    expect(run(pgError('XX000')).status).toBe(500);
  });

  it('passes through body-parser style 4xx errors', () => {
    expect(
      run(Object.assign(new Error('x'), { status: 413, type: 'entity.too.large' })).body.message,
    ).toMatch(/too large/);
    expect(
      run(Object.assign(new Error('x'), { status: 400, type: 'entity.parse.failed' })).body.message,
    ).toMatch(/JSON/);
  });

  it('flattens nested validation errors with dotted field paths', () => {
    const ex = validationExceptionFactory([
      {
        property: 'items',
        constraints: undefined,
        children: [
          {
            property: '0',
            children: [
              {
                property: 'quantity',
                constraints: { min: 'too small', isInt: 'too small' },
                children: [],
              },
            ],
          },
        ],
      },
    ] as never);
    expect(ex).toBeInstanceOf(BadRequestException);
    expect((ex.getResponse() as { details: unknown[] }).details).toEqual([
      { field: 'items.0.quantity', messages: ['too small'] },
    ]);
    expect(ex).toBeInstanceOf(HttpException);
  });
});
