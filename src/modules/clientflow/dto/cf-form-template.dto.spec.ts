import { ValidationPipe } from '@nestjs/common';
import { CreateCfFormTemplateDto, UpdateCfFormTemplateDto } from './cf-form-template.dto';

const fields = [
  { id: 'f', label: 'f', type: 'text', required: false },
];

function transform<T extends { fields?: unknown[] }>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
  return pipe.transform(value, { type: 'body', metatype });
}

describe('form template DTO field transformation', () => {
  it.each([
    ['create', CreateCfFormTemplateDto],
    ['update', UpdateCfFormTemplateDto],
  ])('preserves field objects for the %s DTO', async (_name, metatype) => {
    const result = await transform(metatype, {
      ...(metatype === CreateCfFormTemplateDto
        ? { name: 'Inspired Detroit' }
        : {}),
      programId: 'prog-inspired-detroit',
      scope: 'program_section',
      fields,
    });

    expect(result.fields).toEqual(fields);
  });
});
