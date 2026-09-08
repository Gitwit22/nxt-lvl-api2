const {
  findMissingClientflowSchema,
  REQUIRED_CLIENTFLOW_SCHEMA,
}: {
  findMissingClientflowSchema: (columns: Array<{ table_name: string; column_name: string }>) => string[];
  REQUIRED_CLIENTFLOW_SCHEMA: Record<string, string[]>;
} = require('../../../scripts/ensure-clientflow-settings-schema');
const fs = require('node:fs');
const path = require('node:path');

describe('ClientFlow schema verifier', () => {
  const completeSchema = Object.entries(REQUIRED_CLIENTFLOW_SCHEMA).flatMap(
    ([tableName, columnNames]) => columnNames.map((columnName) => ({
      table_name: tableName,
      column_name: columnName,
    })),
  );

  it('accepts all schema dependencies used by public form submission', () => {
    expect(findMissingClientflowSchema(completeSchema)).toEqual([]);
  });

  it('reports missing notification and intake response dependencies', () => {
    const incompleteSchema = completeSchema.filter(({ table_name, column_name }) =>
      !(
        (table_name === 'CfNotification' && column_name === 'submissionId')
        || (table_name === 'CfIntakeSubmissionProgram' && column_name === 'responsePayload')
        || (table_name === 'CfProgramEnrollment' && column_name === 'lastModifiedByUserId')
        || (table_name === 'CfActivityLog' && column_name === 'actorUserId')
      ),
    );

    expect(findMissingClientflowSchema(incompleteSchema)).toEqual([
      'CfIntakeSubmissionProgram.responsePayload',
      'CfProgramEnrollment.lastModifiedByUserId',
      'CfActivityLog.actorUserId',
      'CfNotification.submissionId',
    ]);
  });

  it('repairs the program response payload required during submission', () => {
    const script = fs.readFileSync(
      path.resolve(__dirname, '../../../scripts/ensure-clientflow-settings-schema.js'),
      'utf8',
    );

    expect(script).toContain('ALTER TABLE "CfIntakeSubmissionProgram"');
    expect(script).toContain('ADD COLUMN IF NOT EXISTS "responsePayload" JSONB');
  });
});