import { ArgumentsHost, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns and logs the request ID for unexpected Prisma errors', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/public/form/token/submit',
      requestId: 'request-123',
      partition: { slug: 'clientflow' },
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    const error = Object.assign(new Error('Missing table'), {
      code: 'P2021',
      meta: { modelName: 'CfIntakeSubmission', table: 'public.CfIntakeSubmission' },
    });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    new GlobalExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        requestId: 'request-123',
      },
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-123',
        method: 'POST',
        partition: 'clientflow',
        prismaCode: 'P2021',
        prismaModel: 'CfIntakeSubmission',
        prismaTable: 'public.CfIntakeSubmission',
      }),
      expect.any(String),
    );
  });
});