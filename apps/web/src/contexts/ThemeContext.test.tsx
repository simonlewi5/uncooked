import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './ThemeContext'

function TestHarness(): JSX.Element {
  const { theme, motion, density, setTheme, setMotion, setDensity } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="motion">{motion}</span>
      <span data-testid="density">{density}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setMotion('off')}>mo-off</button>
      <button onClick={() => setDensity('compact')}>compact</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-motion')
    document.documentElement.removeAttribute('data-density')
  })

  it('provides default values when localStorage is empty', () => {
    render(
      <ThemeProvider>
        <TestHarness />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(screen.getByTestId('motion').textContent).toBe('default')
    expect(screen.getByTestId('density').textContent).toBe('default')
  })

  it('syncs values to document.documentElement data-attributes', () => {
    render(
      <ThemeProvider>
        <TestHarness />
      </ThemeProvider>
    )
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.motion).toBe('default')
    expect(document.documentElement.dataset.density).toBe('default')
  })

  it('persists updates to localStorage and to documentElement', () => {
    render(
      <ThemeProvider>
        <TestHarness />
      </ThemeProvider>
    )
    act(() => {
      screen.getByText('dark').click()
      screen.getByText('mo-off').click()
      screen.getByText('compact').click()
    })
    expect(localStorage.getItem('un_theme')).toBe('dark')
    expect(localStorage.getItem('un_motion')).toBe('off')
    expect(localStorage.getItem('un_density')).toBe('compact')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.motion).toBe('off')
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('reads initial values from localStorage', () => {
    localStorage.setItem('un_theme', 'dark')
    localStorage.setItem('un_motion', 'subtle')
    localStorage.setItem('un_density', 'cozy')
    render(
      <ThemeProvider>
        <TestHarness />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('motion').textContent).toBe('subtle')
    expect(screen.getByTestId('density').textContent).toBe('cozy')
  })

  it('throws if useTheme is used without provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestHarness />)).toThrow(/ThemeProvider/)
    spy.mockRestore()
  })
})
