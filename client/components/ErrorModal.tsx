"use client"

import { useEffect, useCallback } from "react"
import styles from "./ErrorModal.module.css"
import type { ProcessError, ProcessErrorKind } from "@/app/hooks/useProcessFile"

// ── Flexible error input type ─────────────────────────────────────────────────
// Accepts either a raw string (e.g. from FileInput validation)
// or a structured ProcessError from the API layer.
// Future error shapes just extend this union.
export type ErrorInput = string | ProcessError | null

// ── Internal normalised shape ─────────────────────────────────────────────────
interface NormalisedError {
  title: string
  message: string
  kind: ProcessErrorKind | "validation_error"
}

const KIND_META: Record<NormalisedError["kind"], { title: string; icon: string; accent: string }> = {
  unsupported_format: {
    title: "Unsupported File Format",
    icon: "📄",
    accent: "#f59e0b",
  },
  invalid_structure: {
    title: "Invalid Event Log Structure",
    icon: "🧩",
    accent: "#f97316",
  },
  processing_error: {
    title: "Processing Error",
    icon: "⚙️",
    accent: "#ef4444",
  },
  network_error: {
    title: "Connection Error",
    icon: "🔌",
    accent: "#8b5cf6",
  },
  validation_error: {
    title: "Validation Error",
    icon: "⚠️",
    accent: "#eab308",
  },
}

function normalise(error: ErrorInput): NormalisedError | null {
  if (!error) return null
  if (typeof error === "string") {
    return {
      title: KIND_META.validation_error.title,
      message: error,
      kind: "validation_error",
    }
  }
  return {
    title: KIND_META[error.kind]?.title ?? "Error",
    message: error.message,
    kind: error.kind,
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ErrorModalProps {
  error: ErrorInput
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ErrorModal({ error, onClose }: ErrorModalProps) {
  const normalised = normalise(error)

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!normalised) return
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [normalised, handleKeyDown])

  if (!normalised) return null

  const meta = KIND_META[normalised.kind]

  return (
    // Backdrop — click outside to close
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent": meta.accent } as React.CSSProperties}
      >
        {/* Accent bar */}
        <div className={styles.accentBar} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <span className={styles.icon}>{meta.icon}</span>
          </div>
          <div className={styles.titles}>
            <span className={styles.kindLabel}>{normalised.kind.replace(/_/g, " ")}</span>
            <h3 id="error-modal-title" className={styles.title}>
              {normalised.title}
            </h3>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close error modal"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Message */}
        <p className={styles.message}>{normalised.message}</p>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.dismissBtn} onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}