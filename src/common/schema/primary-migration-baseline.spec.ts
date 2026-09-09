/* eslint-disable @typescript-eslint/no-require-imports */
const {
  REQUIRED_COLUMNS,
  REQUIRED_CONSTRAINTS,
  REQUIRED_INDEXES,
  findBaselineProblems,
}: {
  REQUIRED_COLUMNS: string[];
  REQUIRED_CONSTRAINTS: string[];
  REQUIRED_INDEXES: string[];
  findBaselineProblems: (state: {
    columns: string[];
    indexes: string[];
    constraints: string[];
    legacyClientflowTableCount: number;
    platformIdentityReady: boolean;
  }) => string[];
} = require('../../../scripts/ensure-primary-migration-baseline');

function completeState() {
  return {
    columns: [...REQUIRED_COLUMNS],
    indexes: [...REQUIRED_INDEXES],
    constraints: [...REQUIRED_CONSTRAINTS],
    legacyClientflowTableCount: 0,
    platformIdentityReady: true,
  };
}

describe('primary migration baseline guard', () => {
  it('accepts the verified split-database baseline', () => {
    expect(findBaselineProblems(completeState())).toEqual([]);
  });

  it('refuses a partial or mixed ClientFlow baseline', () => {
    const state = completeState();
    state.columns = state.columns.filter((name) => name !== 'AuthSession.refreshTokenHash');
    state.legacyClientflowTableCount = 1;
    state.platformIdentityReady = false;

    expect(findBaselineProblems(state)).toEqual([
      'column:AuthSession.refreshTokenHash',
      'legacy-clientflow-tables',
      'platform-identity',
    ]);
  });
});
