import { ValidationPipe } from '@nestjs/common';
import { CreateCfFormTemplateDto, UpdateCfFormTemplateDto } from './cf-form-template.dto';

const fields = [
  {
    id: 'brandType',
    label: 'What best describes your brand?',
    type: 'select',
    required: true,
    options: ['Creator', 'Product brand', 'Service brand'],
  },
  {
    id: 'contentType',
    label: 'What type of content do you create?',
    type: 'select',
    required: true,
    options: ['Video', 'Audio', 'Written'],
  },
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
      programId: 'prog-creator',
      scope: 'program_section',
      fields,
    });

    expect(result.fields).toEqual(fields);
  });
});
