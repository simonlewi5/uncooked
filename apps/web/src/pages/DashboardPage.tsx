import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import styles from './DashboardPage.module.css'

const FEATURES = [
  {
    to: '/interview',
    icon: '🎤',
    title: 'Practice interviews',
    description:
      'Run an AI-powered mock interview tailored to the specific role and company you are targeting.',
    action: 'Start practicing',
  },
  {
    to: '/research',
    icon: '🔍',
    title: 'Research a company',
    description:
      'Get a concise brief on a company — culture, recent news, and what interviewers typically ask.',
    action: 'Research now',
  },
  {
    to: '/resume',
    icon: '📄',
    title: 'Polish your resume',
    description:
      'Paste your resume and receive targeted feedback aligned to the job you are applying for.',
    action: 'Review resume',
  },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className={styles.greetingSubtitle}>What would you like to work on today?</p>
      </div>

      <p className={styles.sectionTitle}>Features</p>

      <div className={styles.grid}>
        {FEATURES.map(({ to, icon, title, description, action }) => (
          <Link key={to} to={to} className={styles.featureCard}>
            <span className={styles.cardIcon}>{icon}</span>
            <p className={styles.cardTitle}>{title}</p>
            <p className={styles.cardDesc}>{description}</p>
            <span className={styles.cardAction}>
              {action} <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
