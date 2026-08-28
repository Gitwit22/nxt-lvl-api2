import {
  calculateEnrollmentProgress,
  calculateTrackProgress,
  validateCustomWeights,
  type ProgressTrackInput,
} from './progress-calculator';

describe('progress calculator', () => {
  it('splits equal-weight checkpoints evenly', () => {
    const track: ProgressTrackInput = {
      calculationMethod: 'equal_weight',
      checkpoints: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'not_started' },
        { status: 'blocked' },
      ],
    };

    expect(calculateTrackProgress(track)).toBe(40);
  });

  it('uses custom checkpoint weights and treats skipped checkpoints as resolved', () => {
    const track: ProgressTrackInput = {
      calculationMethod: 'custom_weight',
      checkpoints: [
        { status: 'completed', weight: 10 },
        { status: 'skipped', weight: 15 },
        { status: 'in_progress', weight: 30 },
        { status: 'not_started', weight: 45 },
      ],
    };

    expect(calculateTrackProgress(track)).toBe(25);
  });

  it('averages active tracks with equal track weighting', () => {
    const tracks: ProgressTrackInput[] = [
      {
        calculationMethod: 'equal_weight',
        checkpoints: [{ status: 'completed' }, { status: 'completed' }],
      },
      {
        calculationMethod: 'equal_weight',
        checkpoints: [
          { status: 'completed' },
          { status: 'in_progress' },
          { status: 'not_started' },
          { status: 'blocked' },
          { status: 'completed' },
        ],
      },
    ];

    expect(calculateEnrollmentProgress(tracks, 'equal_weight')).toEqual({
      overallPercent: 70,
      trackPercents: [100, 40],
    });
  });

  it('normalizes custom track weights after a track is skipped', () => {
    const tracks: ProgressTrackInput[] = [
      {
        calculationMethod: 'equal_weight',
        weight: 50,
        checkpoints: [{ status: 'completed' }],
      },
      {
        calculationMethod: 'equal_weight',
        weight: 30,
        checkpoints: [{ status: 'completed' }, { status: 'not_started' }],
      },
      {
        calculationMethod: 'equal_weight',
        weight: 20,
        status: 'skipped',
        checkpoints: [{ status: 'not_started' }],
      },
    ];

    expect(calculateEnrollmentProgress(tracks, 'custom_weight')).toEqual({
      overallPercent: 81.25,
      trackPercents: [100, 50, 0],
    });
  });

  it('returns zero when there are no active tracks', () => {
    expect(calculateEnrollmentProgress([], 'equal_weight')).toEqual({
      overallPercent: 0,
      trackPercents: [],
    });
  });

  it('rejects invalid custom checkpoint totals', () => {
    expect(() => validateCustomWeights([40, 40], 'Checkpoint')).toThrow(
      'Checkpoint weights must total 100.',
    );
    expect(() => validateCustomWeights([50, null, 50], 'Checkpoint')).toThrow(
      'Checkpoint must be a non-negative number.',
    );
  });
});