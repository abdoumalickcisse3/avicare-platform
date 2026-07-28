import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { makeStore } from "@/store/store";
import { avicareTheme } from "@/theme";
import { ToastProvider } from "@/components/feedback/ToastProvider";

/** Render a component inside a fresh Redux store + the Jawdi MUI theme + toasts. */
export function renderWithProviders(ui: ReactElement) {
  const store = makeStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={avicareTheme}>
          <ToastProvider>{ui}</ToastProvider>
        </ThemeProvider>
      </Provider>,
    ),
  };
}
