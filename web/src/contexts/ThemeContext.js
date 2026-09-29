'use client';

import { createContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { usersApi } from '../lib/api';

export const ThemeContext = createContext();

const THEME_KEY = 'theme';
const THEMES = ['light', 'dark'];

// The theme is a per-browser display preference, so localStorage is fine here.
// It never holds anything security-relevant.
function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.body.setAttribute('data-bs-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  // Explicit choice made in this browser session, if any.
  const [choice, setChoice] = useState(null);
  const [stored] = useState(readStoredTheme);

  // Priority: this session's choice > the account's saved preference > this browser's last theme.
  const theme = choice ?? (THEMES.includes(user?.theme) ? user.theme : null) ?? stored ?? 'light';

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(
    async (next) => {
      if (!THEMES.includes(next)) return;
      setChoice(next);
      if (user) {
        // Saving to the account is best-effort until PATCH /api/users/me exists.
        await usersApi.updateMe({ theme: next }).catch(() => {});
      }
    },
    [user]
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
