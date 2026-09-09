const { spawnSync } = require('node:child_process');

const DEPLOY_PHASES = [
  ['ClientFlow migrations', 'prisma:deploy:clientflow'],
  ['ClientFlow schema repair', 'prisma:ensure:clientflow-schema'],
  ['ClientFlow auth repair', 'prisma:ensure:clientflow-auth'],
  ['Primary migration baseline', 'prisma:baseline:primary'],
  ['Primary migrations', 'prisma:deploy'],
];

function databaseIdentity(value) {
  const url = new URL(value);
  const hostname = url.hostname.replace('-pooler.', '.');
  return `${hostname}${url.pathname}`;
}

function validateEnvironment(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!env.CLIENTFLOW_DATABASE_URL) throw new Error('CLIENTFLOW_DATABASE_URL is required.');
  if (databaseIdentity(env.DATABASE_URL) === databaseIdentity(env.CLIENTFLOW_DATABASE_URL)) {
    throw new Error('DATABASE_URL and CLIENTFLOW_DATABASE_URL must target different databases.');
  }
}

function defaultRunPhase(script, env) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', script], {
    env,
    stdio: 'inherit',
  });
  return result.error ? 1 : (result.status ?? 1);
}

function runDeployment({ env = process.env, runPhase = defaultRunPhase } = {}) {
  validateEnvironment(env);
  const failures = [];

  for (const [label, script] of DEPLOY_PHASES) {
    console.log(`[deploy] Starting ${label}.`);
    const status = runPhase(script, env);
    if (status === 0) {
      console.log(`[deploy] Completed ${label}.`);
    } else {
      failures.push(label);
      console.error(`[deploy] Failed ${label} with exit code ${status}.`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Deployment preparation failed: ${failures.join(', ')}.`);
  }
}

if (require.main === module) {
  try {
    runDeployment();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { DEPLOY_PHASES, databaseIdentity, runDeployment, validateEnvironment };
