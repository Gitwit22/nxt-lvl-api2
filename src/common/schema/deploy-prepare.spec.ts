/* eslint-disable @typescript-eslint/no-require-imports */
const {
  databaseIdentity,
  runDeployment,
  validateEnvironment,
}: {
  databaseIdentity: (value: string) => string;
  runDeployment: (options: {
    env: NodeJS.ProcessEnv;
    runPhase: (script: string) => number;
  }) => void;
  validateEnvironment: (env: NodeJS.ProcessEnv) => void;
} = require('../../../scripts/deploy-prepare');

const env = {
  DATABASE_URL: 'postgresql://user:secret@primary.example/neondb',
};

describe('deploy preparation', () => {
  it('requires a database target', () => {
    expect(() => validateEnvironment({}))
      .toThrow('DATABASE_URL is required.');
  });

  it('compares targets without credentials or pooler aliases', () => {
    expect(databaseIdentity('postgresql://user:secret@host-pooler.example/neondb'))
      .toBe('host.example/neondb');
  });

  it('stops immediately when a migration phase fails', () => {
    const calls: string[] = [];

    expect(() => runDeployment({
      env,
      runPhase: (script) => {
        calls.push(script);
        return script === 'prisma:baseline:primary' ? 1 : 0;
      },
    })).toThrow('Platform migration baseline');

    expect(calls).toEqual(['prisma:baseline:primary']);
  });

  it('completes when every phase succeeds', () => {
    expect(() => runDeployment({ env, runPhase: () => 0 })).not.toThrow();
  });
});
