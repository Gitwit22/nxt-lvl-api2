import { BadRequestException } from '@nestjs/common';
import type { ClientflowService } from './clientflow.service';
import { ClientflowController } from './clientflow.controller';
import type { EnrollmentService } from './enrollment.service';
import type { MonitoringService } from './monitoring.service';

describe('ClientflowController pagination', () => {
  const service = {
    listAllTerms: jest.fn(),
    listAllContracts: jest.fn(),
    listAllDocuments: jest.fn(),
    listAllCommunications: jest.fn(),
    listAllFinalReports: jest.fn(),
  };
  const controller = new ClientflowController(
    service as unknown as ClientflowService,
    {} as EnrollmentService,
    {} as MonitoringService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses default pagination values', () => {
    controller.listAllTerms();

    expect(service.listAllTerms).toHaveBeenCalledWith(200, 0);
  });

  it('caps the page size and preserves a valid offset', () => {
    controller.listAllContracts('900', '500');

    expect(service.listAllContracts).toHaveBeenCalledWith(500, 500);
  });

  it.each([
    ['0', undefined],
    ['-1', undefined],
    ['2.5', undefined],
    ['abc', undefined],
    [undefined, '-1'],
    [undefined, '1.5'],
    [undefined, 'abc'],
  ])('rejects invalid pagination limit=%s offset=%s', (limit, offset) => {
    expect(() => controller.listAllDocuments(limit, offset)).toThrow(BadRequestException);
    expect(service.listAllDocuments).not.toHaveBeenCalled();
  });
});