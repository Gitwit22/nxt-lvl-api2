const { spawnSync } = require('node:child_process');

const DEPLOY_PHASES = [
  ['Platform migration baseline', 'prisma:baseline:primary'],
  ['Platform migrations', 'prisma:deploy'],
];

function databaseIdentity(value) {
  const url = new URL(value);
  const hostname = url.hostname.replace('-pooler.', '.');
  return `${hostname}${url.pathname}`;
}

function validateEnvironment(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
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
  console.log(`[deploy] Platform database: ${databaseIdentity(env.DATABASE_URL)}.`);

  for (const [label, script] of DEPLOY_PHASES) {
    console.log(`[deploy] Starting ${label}.`);
    const status = runPhase(script, env);
    if (status === 0) {
      console.log(`[deploy] Completed ${label}.`);
    } else {
      throw new Error(`[deploy] Failed ${label} with exit code ${status}.`);
    }
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
