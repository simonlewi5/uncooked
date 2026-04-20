import styles from './IrisAvatar.module.css'

interface IrisAvatarProps {
  initial: string
  size?: number
}

export function IrisAvatar({ initial, size = 28 }: IrisAvatarProps): JSX.Element {
  const fontSize = Math.round(size * 0.4)
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize }}
      aria-hidden="true"
    >
      {initial.toUpperCase()}
    </span>
  )
}
