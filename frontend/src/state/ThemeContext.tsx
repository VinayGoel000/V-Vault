import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEME_STORAGE_KEY = "v-vault-theme";

export type ThemeName = "royal-violet" | "ocean-teal" | "sunset-warm" | "midnight";

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  header: string;
  headerText: string;
  bg: string;
  accent: string;
  accentDark: string;
}

export const themes: ThemeDefinition[] = [
  {
    name: "royal-violet",
    label: "Royal Violet",
    header: "#5B21B6",
    headerText: "#FFFFFF",
    bg: "#F3F0FF",
    accent: "#5B21B6",
    accentDark: "#4C1D95",
  },
  {
    name: "ocean-teal",
    label: "Ocean Teal",
    header: "#0F766E",
    headerText: "#FFFFFF",
    bg: "#ECFDF9",
    accent: "#0F766E",
    accentDark: "#115E59",
  },
  {
    name: "sunset-warm",
    label: "Sunset Warm",
    header: "#C2410C",
    headerText: "#FFFFFF",
    bg: "#FFF7ED",
    accent: "#C2410C",
    accentDark: "#9A3412",
  },
  {
    name: "midnight",
    label: "Midnight",
    header: "#030712",
    headerText: "#FFFFFF",
    bg: "#111827",
    accent: "#EAB308",
    accentDark: "#CA8A04",
  },
];

interface ThemeContextValue {
  theme: ThemeDefinition;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (themes.some((candidate) => candidate.name === stored)) {
      return stored as ThemeName;
    }
  } catch {
    // A blocked storage API should not prevent the app from opening.
  }
  return "ocean-teal";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(initialTheme);
  const theme = themes.find((candidate) => candidate.name === themeName) ?? themes[1]!;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.name;
    root.style.setProperty("--header", theme.header);
    root.style.setProperty("--header-text", theme.headerText);
    root.style.setProperty("--bg", theme.bg);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-dark", theme.accentDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.name);
    } catch {
      // Theme persistence is optional and never contains secrets.
    }
  }, [theme]);

  const setTheme = useCallback((name: ThemeName) => setThemeName(name), []);
  const value = useMemo(
    () => ({ theme, themeName, setTheme }),
    [setTheme, theme, themeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
