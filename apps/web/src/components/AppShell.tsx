import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Moon, Search, Star, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useConsistencyMetrics } from '@/contexts/ConsistencyMetricsContext'
import { useGamificationData } from '@/hooks/useGamificationData'
import { IrisAvatar } from '@/components/ui/IrisAvatar'
import { NavChip } from '@/components/ui/NavChip'
import { TweaksPanel } from '@/components/ui/TweaksPanel'
import styles from './AppShell.module.css'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/research', label: 'Research' },
  { to: '/resume', label: 'Resume' },
  { to: '/interview', label: 'Practice' },
  { to: '/applications', label: 'Applications' },
] as const

interface UnderlineRect {
  left: number
  width: number
  visible: boolean
}

function useMaxStreak(): number | null {
  const { data } = useConsistencyMetrics()
  if (!data) return null
  return Math.max(
    data.resume.currentStreakDays,
    data.interview.currentStreakDays,
    data.research.currentStreakDays,
  )
}

export default function AppShell(): JSX.Element {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { data: gamification } = useGamificationData()
  const streak = useMaxStreak()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const navRef = useRef<HTMLElement>(null)
  const [underline, setUnderline] = useState<UnderlineRect>({
    left: 0,
    width: 0,
    visible: false,
  })

  const measureUnderline = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLAnchorElement>(`.${styles.active}`)
    if (!active) {
      setUnderline((prev) => ({ ...prev, visible: false }))
      return
    }
    setUnderline({
      left: active.offsetLeft,
      width: active.offsetWidth,
      visible: true,
    })
  }, [])

  const { pathname } = useLocation()

  useEffect(() => {
    const raf = requestAnimationFrame(measureUnderline)
    window.addEventListener('resize', measureUnderline)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measureUnderline)
    }
  }, [measureUnderline, pathname])

  useEffect(() => {
    const handler = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initial = user?.email?.[0] ?? '?'

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand} aria-label="Uncooked home">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect
              x="2.5"
              y="2.5"
              width="13"
              height="13"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.4"
              transform="rotate(45 9 9)"
            />
            <circle cx="9" cy="9" r="2" fill="currentColor" />
          </svg>
          <span className={styles.logo}>UNCOOKED</span>
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <nav className={styles.nav} ref={navRef} aria-label="Main">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.active : ''].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
          <span
            className={styles.underline}
            aria-hidden="true"
            style={{
              left: underline.left,
              width: underline.width,
              opacity: underline.visible ? 1 : 0,
            }}
          />
        </nav>

        <div className={styles.spacer} />

        <div className={styles.chips}>
          {gamification && (
            <NavChip
              icon={<Star size={11} strokeWidth={1.4} />}
              label={`LVL ${gamification.level}`}
              title={`Career level: ${gamification.tierLabel}`}
            />
          )}
          {streak !== null && streak > 0 && (
            <NavChip label={`${streak}D`} pulse title="Daily streak" />
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.iconBtn} aria-label="Search" type="button">
            <Search size={16} />
          </button>
          <button className={styles.iconBtn} aria-label="Notifications" type="button">
            <Bell size={16} />
          </button>
          <button
            className={styles.iconBtn}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
            type="button"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className={styles.avatarWrapper} ref={menuRef}>
            <button
              className={styles.avatarBtn}
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="User menu"
              type="button"
            >
              <IrisAvatar initial={initial} />
              <ChevronDown size={12} className={menuOpen ? styles.chevronOpen : undefined} />
            </button>

            {menuOpen && (
              <div className={styles.dropdown} role="menu">
                <div className={styles.dropdownHeader}>
                  <p className={styles.dropdownEmail}>{user?.email}</p>
                </div>
                <div className={styles.dropdownDivider} />
                <button
                  className={styles.dropdownItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void signOut()
                  }}
                  type="button"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <TweaksPanel />
    </div>
  )
}
