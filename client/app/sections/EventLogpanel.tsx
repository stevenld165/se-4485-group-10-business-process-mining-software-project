"use client"

import { useState } from "react"
import { EventLogRow } from "../hooks/useProcessFile"
import styles from "./EventLogpanel.module.css"

const PAGE_SIZE = 50

interface EventLogPanelProps {
  data: EventLogRow[]
  onRowClick?: (row: EventLogRow) => void
}

export default function EventLogPanel({ data, onRowClick }: EventLogPanelProps) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  if (!data || data.length === 0) {
    return <div className={styles.empty}>No data available.</div>
  }

  const columns = Object.keys(data[0])
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // When jumping pages, reset the selected row since indices change
  const goToPage = (next: number) => {
    setPage(next)
    setSelectedRowIndex(null)
  }

  return (
    <div className={styles.wrapper}>

      {/* Scrollable table area */}
      <div className={styles.scrollContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {columns.map((col) => (
                <th key={col} className={styles.th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={i}
                className={`${styles.tr} ${i === selectedRowIndex ? styles.trSelected : ""} ${onRowClick ? styles.trClickable : ""}`}
                onClick={() => {
                  setSelectedRowIndex(i)
                  onRowClick?.(row)
                }}
              >
                {columns.map((col) => (
                  <td key={col} className={styles.td}>
                    {String(row[col] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls — only shown when there is more than one page */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => goToPage(0)}
            disabled={page === 0}
          >
            «
          </button>
          <button
            className={styles.pageBtn}
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
          >
            ‹
          </button>

          <span className={styles.pageInfo}>
            Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            <span className={styles.rowCount}>({data.length.toLocaleString()} rows)</span>
          </span>

          <button
            className={styles.pageBtn}
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages - 1}
          >
            ›
          </button>
          <button
            className={styles.pageBtn}
            onClick={() => goToPage(totalPages - 1)}
            disabled={page === totalPages - 1}
          >
            »
          </button>
        </div>
      )}

    </div>
  )
}