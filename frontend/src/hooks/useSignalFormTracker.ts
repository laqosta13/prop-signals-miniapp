import { useAdminTrackerSnapshot } from "./useAdminTrackerSnapshot";
import { useSignalFormLimitsState } from "./signalFormLimitsState";

type StakeSync = {
  risk: string;
  setRisk: (value: string) => void;
};

type LeverageSync = {
  leverage: string;
  setLeverage: (value: string) => void;
};

export function useSignalFormTracker(
  enabled: boolean,
  stake: StakeSync,
  leverageSync: LeverageSync,
  excludeSignalId?: number,
) {
  const { snapshot: trackerSnap, loading: trackerLoading } = useAdminTrackerSnapshot(
    enabled,
    excludeSignalId,
  );

  return useSignalFormLimitsState(
    enabled,
    trackerSnap,
    trackerLoading,
    stake,
    leverageSync,
    excludeSignalId,
  );
}
