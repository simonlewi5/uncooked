import styles from './ConsistencyBars.module.css'

interface ConsistencyBarsProps {
  buckets: readonly number[]
  labels: readonly string[]
  formatTooltip?: (value: number) => string
}

export function ConsistencyBars({
  buckets,
  labels,
  formatTooltip,
}: ConsistencyBarsProps): JSX.Element {
  const max = Math.max(1, ...buckets)
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}
    >
      {buckets.map((value, i) => {
        const pct = (value / max) * 100
        const isFilled = value > 0
        const tooltip =
          formatTooltip?.(value) ?? (isFilled ? String(value) : 'No activity')
        return (
          <div key={`bucket-${i}`} className={styles.col} data-tooltip={tooltip}>
            <div
              className={`${styles.bar} ${isFilled ? styles.barFilled : styles.barEmpty}`}
              style={{ height: `${pct}%`, minHeight: isFilled ? 4 : 2 }}
            />
            <span className={styles.label}>{labels[i] ?? ''}</span>
          </div>
        )
      })}
    </div>
  )
}
