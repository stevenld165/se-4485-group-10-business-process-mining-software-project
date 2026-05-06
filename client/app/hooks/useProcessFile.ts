"use client"

import { useState } from "react"

// ── Types that mirror the backend response shape ──────────────────────────────

export interface EventLogRow {
  [key: string]: string | number | null
}

export interface ProcessResult {
  bundleId: string
  bpmnXml: string
  ccelData: EventLogRow[]
  ocelData: EventLogRow[] | null // null = input was already CCEL
  roles: Record<string, string[]>
  isEdited?: boolean
}

// ── Error types returned as user-visible warnings ─────────────────────────────

export type ProcessErrorKind =
  | "unsupported_format" // 400 — file extension not accepted
  | "invalid_structure" // 422 — columns don't match OCEL or CCEL
  | "processing_error" // 500 — internal server failure
  | "network_error" // fetch failed entirely

export interface ProcessError {
  kind: ProcessErrorKind
  message: string
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseProcessFileReturn {
  result: ProcessResult | null
  isLoading: boolean
  error: ProcessError | null
  processFile: (file: File) => Promise<ProcessResult | null>
  loadFromRecord: (saved: ProcessResult) => void
  clearError: () => void
}

export function useProcessFile(): UseProcessFileReturn {
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ProcessError | null>(null)

  const clearError = () => setError(null)

  const processFile = async (file: File): Promise<ProcessResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("http://localhost:8000/diagram", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        // Parse the FastAPI error detail if available
        let detail = "An unexpected error occurred."
        try {
          const errBody = await response.json()
          detail = errBody?.detail ?? detail
        } catch {
          // body wasn't JSON
        }

        const kind: ProcessErrorKind =
          response.status === 400
            ? "unsupported_format"
            : response.status === 422
              ? "invalid_structure"
              : "processing_error"

        setError({ kind, message: detail })
        return null
      }

      const blob = await response.blob()
      const text = await blob.text()
      const json = JSON.parse(text)
      const parsed = _parseBackendResponse(json)
      setResult(parsed)
      return parsed
    } catch (err) {
      setError({
        kind: "network_error",
        message:
          "Could not reach the server. Make sure the backend is running on port 8000.",
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const loadFromRecord = (saved: ProcessResult) => {
    setError(null)
    setResult(saved)
  }

  return { result, isLoading, error, processFile, loadFromRecord, clearError }
}

// ── Internal parser ───────────────────────────────────────────────────────────

function _parseBackendResponse(json: any): ProcessResult {
  const ccelRaw = json.contents?.ccel?.data
  const ocelRaw = json.contents?.ocel?.data ?? null
  const swimlaneRaw = json.contents?.swimlane?.data ?? ""
  const roles = json.contents?.swimlane?.roles ?? {}

  return {
    bundleId: json.bundle_id ?? "",
    bpmnXml: swimlaneRaw,
    ccelData: _normaliseRows(ccelRaw),
    ocelData: ocelRaw ? _normaliseRows(ocelRaw) : null,
    roles,
  }
}

/**
 * The backend stores DataFrames as JSON records (array of row objects).
 * Normalise whatever shape arrives into a plain array of row objects.
 */
function _normaliseRows(raw: any): EventLogRow[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as EventLogRow[]
  // pandas to_json with orient="records" gives an array;
  // orient="split" gives { columns, data } — handle both
  if (raw.data && raw.columns) {
    return (raw.data as any[][]).map((row) =>
      Object.fromEntries(
        raw.columns.map((col: string, i: number) => [col, row[i]]),
      ),
    )
  }
  return []
}
