import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'
export type Motion = 'off' | 'subtle' | 'default' | 'expressive'
export type Density = 'cozy' | 'default' | 'compact'

interface ThemeContextValue {
  theme: Theme
  motion: Motion
  density: Density
  setTheme: (t: Theme) => void
  setMotion: (m: Motion) => void
  setDensity: (d: Density) => void
  toggleTheme: () => void
}

const STORAGE_KEYS = {
  theme: 'un_theme',
  motion: 'un_motion',
  density: 'un_density',
} as const

const THEMES: readonly Theme[] = ['light', 'dark']
const MOTIONS: readonly Motion[] = ['off', 'subtle', 'default', 'expressive']
const DENSITIES: readonly Density[] = ['cozy', 'default', 'compact']

function readStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  return allowed.includes(raw as T) ? (raw as T) : fallback
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStored<Theme>(STORAGE_KEYS.theme, THEMES, 'light')
  )
  const [motion, setMotionState] = useState<Motion>(() =>
    readStored<Motion>(STORAGE_KEYS.motion, MOTIONS, 'default')
  )
  const [density, setDensityState] = useState<Density>(() =>
    readStored<Density>(STORAGE_KEYS.density, DENSITIES, 'default')
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEYS.theme, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.motion = motion
    window.localStorage.setItem(STORAGE_KEYS.motion, motion)
  }, [motion])

  useEffect(() => {
    document.documentElement.dataset.density = density
    window.localStorage.setItem(STORAGE_KEYS.density, density)
  }, [density])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const setMotion = useCallback((m: Motion) => setMotionState(m), [])
  const setDensity = useCallback((d: Density) => setDensityState(d), [])
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'light' ? 'dark' : 'light')),
    []
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, motion, density, setTheme, setMotion, setDensity, toggleTheme }),
    [theme, motion, density, setTheme, setMotion, setDensity, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
