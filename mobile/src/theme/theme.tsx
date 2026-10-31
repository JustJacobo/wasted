import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { DEFAULT_ACCENT, DEFAULT_MODE, parseAccent, parseMode, type Accent, type ColorMode } from "@/lib/theme";
import { palette, type Palette } from "./tokens";

const STORAGE_KEY = "wasted-appearance";

interface ThemeValue {
  colors: Palette;
  scheme: "light" | "dark";
  accent: Accent;
  mode: ColorMode;
  /** Aplica lo guardado en la cuenta (llega con el inicio) o lo elegido en Ajustes. */
  setAppearance: (appearance: { accent?: string | null; mode?: string | null }) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [accent, setAccent] = useState<Accent>(DEFAULT_ACCENT);
  const [mode, setMode] = useState<ColorMode>(DEFAULT_MODE);

  // Lo último que se usó en este teléfono, para pintar el tema correcto desde el inicio.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      const value = JSON.parse(saved) as { accent?: string; mode?: string };
      setAccent(parseAccent(value.accent));
      setMode(parseMode(value.mode));
    });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
    return {
      colors: palette(scheme, accent),
      scheme,
      accent,
      mode,
      setAppearance: (next) => {
        const a = next.accent !== undefined ? parseAccent(next.accent) : accent;
        const m = next.mode !== undefined ? parseMode(next.mode) : mode;
        setAccent(a);
        setMode(m);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accent: a, mode: m }));
      },
    };
  }, [accent, mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme fuera de ThemeProvider");
  return value;
}
