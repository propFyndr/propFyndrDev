/**
 * Builder theme utilities
 * Applies builder-specific branding to property/builder pages
 */

export interface BuilderTheme {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    tertiary: string
    neutral?: string
    surface?: string
    'on-surface'?: string
    error?: string
    overlay?: string
    border?: string
  }
  typography?: {
    headline?: string
    body?: string
    label?: string
  }
}

export const DEFAULT_THEME: BuilderTheme = {
  id: 'default',
  name: 'RealtyAsk Default',
  colors: {
    primary: '#3b82f6',
    secondary: '#e0e7ff',
    tertiary: '#1f2937',
    neutral: '#ffffff',
    'on-surface': '#000000',
    error: '#dc2626',
    overlay: '#000000cc',
    border: '#e5e7eb'
  },
  typography: {
    headline: 'Inter',
    body: 'Inter',
    label: 'Inter'
  }
}

export const ELITE_THEME: BuilderTheme = {
  id: 'elite-group',
  name: 'Elite-X Prestige',
  colors: {
    primary: '#c47860',
    secondary: '#f2e8d8',
    tertiary: '#171412',
    neutral: '#ffffff',
    'on-surface': '#000000',
    error: '#b33a3a',
    overlay: '#000000cc',
    border: '#c4786033'
  },
  typography: {
    headline: 'Cinzel',
    body: 'Cormorant Garamond',
    label: 'Josefin Sans'
  }
}

/**
 * Inject theme CSS variables into document
 */
export function applyTheme(theme: BuilderTheme = DEFAULT_THEME) {
  const root = document.documentElement

  // Set CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--theme-color-${key}`, value)
  })

  if (theme.typography) {
    Object.entries(theme.typography).forEach(([key, value]) => {
      root.style.setProperty(`--theme-font-${key}`, value)
    })
  }

  // Store active theme
  sessionStorage.setItem('active-builder-theme', JSON.stringify(theme))
}

/**
 * Get current theme from session or default
 */
export function getCurrentTheme(): BuilderTheme {
  const stored = sessionStorage.getItem('active-builder-theme')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return DEFAULT_THEME
    }
  }
  return DEFAULT_THEME
}

/**
 * Generate Tailwind-compatible color classes from theme
 * Used in inline styles or className props
 */
export function getThemeColors(theme: BuilderTheme = getCurrentTheme()) {
  return {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    tertiary: theme.colors.tertiary,
    neutral: theme.colors.neutral || '#ffffff',
    surface: theme.colors.surface || '#ffffff',
    onSurface: theme.colors['on-surface'] || '#000000',
    error: theme.colors.error || '#dc2626',
    overlay: theme.colors.overlay || '#000000cc',
    border: theme.colors.border || '#e5e7eb'
  }
}

/**
 * Create style tag with theme-aware CSS
 * For injecting component-specific styles
 */
export function createThemeStyles(
  theme: BuilderTheme = getCurrentTheme(),
  selector: string = ':root'
): string {
  const colors = getThemeColors(theme)
  const fonts = theme.typography || { headline: 'sans-serif', body: 'sans-serif', label: 'sans-serif' }

  return `
    ${selector} {
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-tertiary: ${colors.tertiary};
      --color-neutral: ${colors.neutral};
      --color-surface: ${colors.surface};
      --color-on-surface: ${colors.onSurface};
      --color-error: ${colors.error};
      --color-overlay: ${colors.overlay};
      --color-border: ${colors.border};
      --font-headline: ${fonts.headline};
      --font-body: ${fonts.body};
      --font-label: ${fonts.label};
    }
  `
}
