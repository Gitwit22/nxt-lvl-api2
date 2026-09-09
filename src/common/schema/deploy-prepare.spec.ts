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
  CLIENTFLOW_DATABASE_URL: 'postgresql://user:secret@clientflow.example/neondb',
};

describe('deploy preparation', () => {
  it('requires both distinct database targets', () => {
    expect(() => validateEnvironment({ DATABASE_URL: env.DATABASE_URL }))
      .toThrow('CLIENTFLOW_DATABASE_URL is required.');
    expect(() => validateEnvironment({
      DATABASE_URL: 'postgresql://user:one@same-pooler.example/neondb',
      CLIENTFLOW_DATABASE_URL: 'postgresql://user:two@same.example/neondb',
    })).toThrow('must target different databases');
  });

  it('compares targets without credentials or pooler aliases', () => {
    expect(databaseIdentity('postgresql://user:secret@host-pooler.example/neondb'))
      .toBe('host.example/neondb');
  });

  it('repairs ClientFlow and attempts every phase when primary migration fails', () => {
    const calls: string[] = [];

    expect(() => runDeployment({
      env,
      runPhase: (script) => {
        calls.push(script);
        return script === 'prisma:deploy' ? 1 : 0;
      },
    })).toThrow('Primary migrations');

    expect(calls).toEqual([
      'prisma:deploy:clientflow',
      'prisma:ensure:clientflow-schema',
      'prisma:ensure:clientflow-auth',
      'prisma:baseline:primary',
      'prisma:deploy',
    ]);
  });

  it('completes when every phase succeeds', () => {
    expect(() => runDeployment({ env, runPhase: () => 0 })).not.toThrow();
  });
});
