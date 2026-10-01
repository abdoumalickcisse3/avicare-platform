import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** What the backend reported about the window it served, per RTK Query endpoint name. */
export interface ListWindow {
  total: number;
  size: number;
}

/**
 * The backend bounds the lists that grow with the life of a farm (sales, payments, stock
 * movements…) and reports `total` / `truncated` in the response `meta`. Endpoints unwrap the
 * envelope with `transformResponse: r => r.data`, so `meta` would be lost — and a screen would
 * show the 500 newest rows as if they were all of them.
 *
 * It is recorded here instead of being carried in the query result: the lists are filtered and
 * re-sliced all over the UI, and a count smuggled alongside the rows would be dropped by the first
 * `.filter()` that touches them.
 */
type ListWindowState = Record<string, ListWindow>;

const listWindowSlice = createSlice({
  name: "listWindow",
  initialState: {} as ListWindowState,
  reducers: {
    listWindowServed: (
      state,
      action: PayloadAction<{ endpoint: string; truncated: boolean; total: number; size: number }>,
    ) => {
      const { endpoint, truncated, total, size } = action.payload;
      if (truncated) {
        state[endpoint] = { total, size };
      } else {
        delete state[endpoint];
      }
    },
  },
});

export const { listWindowServed } = listWindowSlice.actions;
export default listWindowSlice.reducer;
