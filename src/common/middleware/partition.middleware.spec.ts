import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import { PartitionService } from '../services/partition.service';
import { PartitionMiddleware } from './partition.middleware';

describe('PartitionMiddleware', () => {
  const next = jest.fn() as NextFunction;
  const response = {} as Response;
  const middleware = new PartitionMiddleware(new PartitionService());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function request(originalUrl: string, partition?: string): Request {
    return {
      originalUrl,
      header: jest.fn().mockReturnValue(partition),
    } as unknown as Request;
  }

  it('resolves an explicit ClientFlow partition', () => {
    const req = request('/api/v1/admin/cf/clients', 'clientflow');

    middleware.use(req, response, next);

    expect((req as PartitionRequest).partition.authIssuer).toBe('clientflow-api');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each(['/api/v1/admin/cf/clients', '/api/v1/public/form/token-1'])(
    'rejects a missing partition on %s',
    (originalUrl) => {
      expect(() => middleware.use(request(originalUrl), response, next)).toThrow(
        new BadRequestException('X-App-Partition header is required for this route.'),
      );
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown explicit partition', () => {
    expect(() =>
      middleware.use(request('/api/v1/admin/cf/clients', 'unknown'), response, next),
    ).toThrow(BadRequestException);
    expect(next).not.toHaveBeenCalled();
  });

  it('preserves the default partition for legacy routes', () => {
    const req = request('/api/v1/programs');

    middleware.use(req, response, next);

    expect((req as PartitionRequest).partition.authIssuer).toBe('fbappinc-api2');
    expect(next).toHaveBeenCalledTimes(1);
  });
});