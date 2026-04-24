"use client"

import { useState, useEffect, useCallback } from "react"

export interface UploadRecord {
  id: string
  fileName: string
  fileSize: number          // bytes
  uploadedAt: string        // ISO-8601
  rowCount: number
  bpmnXml: string
  eventLogJson: string      // JSON-serialised Entry[]
}

const STORAGE_KEY = "upload_history_v1"

function loadFromStorage(): UploadRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UploadRecord[]) : []
  } catch {
    return []
  }
}

function saveToStorage(records: UploadRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* quota exceeded – silently skip */
  }
}

export function useUploadHistory() {
  const [history, setHistory] = useState<UploadRecord[]>([])

  /* Hydrate once on the client */
  useEffect(() => {
    setHistory(loadFromStorage())
  }, [])

  const addRecord = useCallback(
    (record: Omit<UploadRecord, "id" | "uploadedAt">) => {
      const newRecord: UploadRecord = {
        ...record,
        id: crypto.randomUUID(),
        uploadedAt: new Date().toISOString(),
      }
      setHistory((prev) => {
        const next = [newRecord, ...prev]
        saveToStorage(next)
        return next
      })
      return newRecord
    },
    []
  )

  const removeRecord = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveToStorage([])
  }, [])

  return { history, addRecord, removeRecord, clearHistory }
}