"use client";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Mode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: Mode;
  isDark: boolean;
  setMode: (mode: Mode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "louagi.admin.theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("system");
  const [isDark, setIsDark] = useState(false);

  const apply = useCallback((next: Mode) => {
    const dark = next === "dark" || (next === "system" && systemPrefersDark());
    setIsDark(dark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", dark);
    }
  }, []);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as Mode | null)
        : null) ?? "system";
    setModeState(saved);
    apply(saved);

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) ?? "system") === "system") {
        apply("system");
      }
    };
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, [apply]);

  const setMode = useCallback(
    (next: Mode) => {
      setModeState(next);
      apply(next);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
    },
    [apply],
  );

  const toggle = useCallback(
    () => setMode(isDark ? "light" : "dark"),
    [isDark, setMode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, setMode, toggle }),
    [mode, isDark, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const v = useContext(ThemeContext);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
