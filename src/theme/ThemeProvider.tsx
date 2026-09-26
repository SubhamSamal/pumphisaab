import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { vars } from "nativewind";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";
import { colorChannels, colors, type ColorName, type Scheme, type ThemePreference } from "./theme";

const STORAGE_KEY = "pumphisaab.themePreference";

const cssVars: Record<Scheme, ReturnType<typeof vars>> = {
  light: vars(toVars(colorChannels.light)),
  dark: vars(toVars(colorChannels.dark)),
};

function toVars(channels: Record<string, string>) {
  return Object.fromEntries(Object.entries(channels).map(([name, rgb]) => [`--color-${name}`, rgb]));
}

type ThemeContextValue = {
  scheme: Scheme;
  /** Hex values for places that can't take a className (icon colours, placeholders). */
  colors: Record<ColorName, string>;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "auto") setPreferenceState(saved);
      })
      .catch(() => {
        // Storage unavailable: stay on Auto. Nothing to show the user.
      });
  }, []);

  const scheme: Scheme = preference === "auto" ? (deviceScheme === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: colors[scheme],
      preference,
      setPreference: (p) => {
        setPreferenceState(p);
        AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
      },
    }),
    [scheme, preference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={cssVars[scheme]} className="flex-1 bg-bg">
        {children}
      </View>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
