export type ProgressCalculationMethod = 'equal_weight' | 'custom_weight';

export type ProgressCheckpointStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped';

export type ProgressTrackStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface ProgressCheckpointInput {
  status: ProgressCheckpointStatus;
  weight?: number | null;
}

export interface ProgressTrackInput {
  calculationMethod: ProgressCalculationMethod;
  checkpoints: ProgressCheckpointInput[];
  status?: ProgressTrackStatus;
  weight?: number | null;
}

export interface ProgressCalculationResult {
  overallPercent: number;
  trackPercents: number[];
}

const COMPLETE_CHECKPOINT_STATUSES = new Set<ProgressCheckpointStatus>([
  'completed',
  'skipped',
]);

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function roundPercent(value: number): number {
  return Math.round(clampPercent(value) * 100) / 100;
}

function requireValidWeight(weight: number | null | undefined, label: string): number {
  if (weight === null || weight === undefined || !Number.isFinite(weight) || weight < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }

  return weight;
}

export function validateCustomWeights(
  weights: Array<number | null | undefined>,
  label: string,
): void {
  if (weights.length === 0) {
    throw new Error(`${label} must contain at least one weight.`);
  }

  const total = weights.reduce<number>(
    (sum, weight) => sum + requireValidWeight(weight, label),
    0,
  );

  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`${label} weights must total 100.`);
  }
}

export function calculateTrackProgress(track: ProgressTrackInput): number {
  if (track.status === 'skipped' || track.checkpoints.length === 0) return 0;

  if (track.calculationMethod === 'equal_weight') {
    const completed = track.checkpoints.filter((checkpoint) =>
      COMPLETE_CHECKPOINT_STATUSES.has(checkpoint.status),
    ).length;

    return roundPercent((completed / track.checkpoints.length) * 100);
  }

  validateCustomWeights(
    track.checkpoints.map((checkpoint) => checkpoint.weight),
    'Checkpoint',
  );

  const completedWeight = track.checkpoints.reduce((sum, checkpoint) => {
    if (!COMPLETE_CHECKPOINT_STATUSES.has(checkpoint.status)) return sum;
    return sum + requireValidWeight(checkpoint.weight, 'Checkpoint');
  }, 0);

  return roundPercent(completedWeight);
}

export function calculateEnrollmentProgress(
  tracks: ProgressTrackInput[],
  calculationMethod: ProgressCalculationMethod,
): ProgressCalculationResult {
  const trackPercents = tracks.map(calculateTrackProgress);
  const activeTracks = tracks
    .map((track, index) => ({ track, percent: trackPercents[index] }))
    .filter(({ track }) => track.status !== 'skipped');

  if (activeTracks.length === 0) return { overallPercent: 0, trackPercents };

  if (calculationMethod === 'equal_weight') {
    const total = activeTracks.reduce((sum, { percent }) => sum + percent, 0);
    return {
      overallPercent: roundPercent(total / activeTracks.length),
      trackPercents,
    };
  }

  const activeWeights = activeTracks.map(({ track }) =>
    requireValidWeight(track.weight, 'Track'),
  );
  const activeWeightTotal = activeWeights.reduce((sum, weight) => sum + weight, 0);

  if (activeWeightTotal === 0) {
    throw new Error('Active track weights must total more than zero.');
  }

  const weightedTotal = activeTracks.reduce(
    (sum, { percent }, index) => sum + percent * activeWeights[index],
    0,
  );

  return {
    overallPercent: roundPercent(weightedTotal / activeWeightTotal),
    trackPercents,
  };
}