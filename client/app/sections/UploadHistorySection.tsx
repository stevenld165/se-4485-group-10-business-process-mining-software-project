"use client"

import { UploadRecord } from "../hooks/useUploadhistory"
import styles from "./UploadHistorySection.module.css"

interface UploadHistorySectionProps {
  history: UploadRecord[]
  onLoad: (record: UploadRecord) => void
  onDelete: (id: string) => void
  onClear: () => void
  mounted: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function UploadHistorySection({
  history,
  onLoad,
  onDelete,
  onClear,
  mounted,
}: UploadHistorySectionProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Upload History</h2>
          <p className={styles.subtitle}>
            Previously uploaded event logs — click one to restore it
          </p>
        </div>
        {mounted && history.length > 0 && (
          <button className={styles.clearBtn} onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {!mounted || history.length === 0 ? (
        <div className={styles.empty}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="8" y="12" width="32" height="28" rx="3" />
            <path d="M16 12V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
            <path d="M20 24h8M20 30h5" />
          </svg>
          <p>No uploads yet. Use the sidebar to upload an event log.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {history.map((record) => (
            <li key={record.id} className={styles.card}>
              <button
                className={styles.cardBody}
                onClick={() => onLoad(record)}
                title="Restore this upload"
              >
                <div className={styles.cardIcon}>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="2" width="12" height="12" rx="1.5" />
                    <path d="M5 6h6M5 9h4" />
                  </svg>
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{record.fileName}</span>
                  <span className={styles.cardMeta}>
                    {formatDate(record.uploadedAt)} &middot;{" "}
                    {record.rowCount.toLocaleString()} rows &middot;{" "}
                    {formatBytes(record.fileSize)}
                  </span>
                </div>
                <span className={styles.cardRestore}>Restore →</span>
              </button>
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(record.id)
                }}
                title="Delete"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 5h10M6 5V3h4v2M6 8v4M10 8v4" />
                  <rect x="4" y="5" width="8" height="8" rx="1" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}