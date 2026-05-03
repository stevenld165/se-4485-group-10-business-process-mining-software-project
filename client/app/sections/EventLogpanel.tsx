"use client"

import { EventLogRow } from "../hooks/useProcessFile"
import styles from "./EventLogpanel.module.css"

interface EventLogPanelProps {
  data: EventLogRow[]
  onRowClick?: (row: EventLogRow) => void
  selectedActivity?: string | null
}

/**
 * A lightweight table that renders any array of EventLogRow objects.
 * Columns are derived automatically from the first row's keys.
 * Clicking a row calls onRowClick; the row whose "activity" matches
 * selectedActivity is highlighted.
 */
export default function EventLogPanel({
  data,
  onRowClick,
  selectedActivity,
}: EventLogPanelProps) {
  if (!data || data.length === 0) {
    return <div className={styles.empty}>No data available.</div>
  }

  const columns = Object.keys(data[0])

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className={styles.th}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const activity = row["activity"] as string | undefined
            const isSelected = activity != null && activity === selectedActivity
            return (
              <tr
                key={i}
                className={`${styles.tr} ${isSelected ? styles.trSelected : ""} ${onRowClick ? styles.trClickable : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col} className={styles.td}>
                    {row[col] ?? "—"}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}