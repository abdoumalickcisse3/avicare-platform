import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { makeStore } from "@/store/store";
import { avicareTheme } from "@/theme";

/** Render a component inside a fresh Redux store + the AviCare MUI theme. */
export function renderWithProviders(ui: ReactElement) {
  const store = makeStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={avicareTheme}>{ui}</ThemeProvider>
      </Provider>,
    ),
  };
}
