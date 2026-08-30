/**
 * Selected-farm state — shared by the batch list (task 8) and every later
 * field screen (task 9+: entry screens all need to know which farm's unit
 * they're recording against).
 *
 * Deliberately its own tiny slice, not part of the auth session and not in
 * SecureStore (`@/auth/tokens`): the chosen farm is a convenience — skip
 * re-picking it after an app restart — never a secret. Persisted through
 * `redux-persist` (see `@/store/persist`), alongside the RTK Query cache.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

/**
 * The window every KPI is read through.
 *
 * It lives here, next to the farm, rather than in each screen's local state: the dashboard and
 * the farm overview show the same indicators, and a farmer who switches to 90 days on one and
 * finds the other still on 7 has been given two different answers to one question. Persisted
 * with the rest of the slice, so the choice survives an app restart.
 */
export type DashboardPeriod = '7d' | '30d' | '90d';

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
};

interface SelectionState {
  selectedFarmId: number | null;
  period: DashboardPeriod;
}

const initialState: SelectionState = {
  selectedFarmId: null,
  // 30 days: long enough that a quiet week does not read as a collapse, short enough that a
  // real change is still visible.
  period: '30d',
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    setSelectedFarmId(state, action: PayloadAction<number | null>) {
      state.selectedFarmId = action.payload;
    },
    setPeriod(state, action: PayloadAction<DashboardPeriod>) {
      state.period = action.payload;
    },
  },
});

export const { setSelectedFarmId, setPeriod } = selectionSlice.actions;
export const selectionReducer = selectionSlice.reducer;

export function selectSelectedFarmId(state: RootState): number | null {
  return state.selection.selectedFarmId;
}

export function selectPeriod(state: RootState): DashboardPeriod {
  // A persisted state written before this field existed has no `period`; without the fallback
  // every dashboard query would send `period=undefined` after an app update.
  return state.selection.period ?? '30d';
}
