"use client"

import { useState, useEffect } from "react"
import { ProcessResult } from "./useProcessFile"

export interface UploadRecord {
  id: string
  fileName: string
  fileSize: number
  rowCount: number
  uploadedAt: string
  savedResult: ProcessResult
}

const STORAGE_KEY = "bpm_upload_history"

function loadHistory(): UploadRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(records: UploadRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

export function useUploadHistory() {
  const [mounted, setMounted] = useState(false)
  const [history, setHistory] = useState<UploadRecord[]>(loadHistory)

  useEffect(() => {
    saveHistory(history)
  }, [history])

  useEffect(() => {
    setHistory(loadHistory())
    setMounted(true)
  }, [])

  const addRecord = (input: Omit<UploadRecord, "id" | "uploadedAt">) => {
    const record: UploadRecord = {
      ...input,
      id: crypto.randomUUID(),
      uploadedAt: new Date().toISOString(),
    }
    setHistory((prev) => [record, ...prev])
  }

  const removeRecord = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRecord = (id: string, xml: string) => {
    const updatedHistory = history.map((record) => {
      if (record.id == id) {
        const updatedResult = {
          ...record.savedResult,
          bpmnXml: xml,
          isEdited: true,
        }
        const updatedRecord: UploadRecord = {
          ...record,
          uploadedAt: new Date().toISOString(),
          savedResult: updatedResult,
        }

        return updatedRecord
      } else return record
    })

    setHistory(updatedHistory)
  }

  const clearHistory = () => setHistory([])

  return {
    history,
    addRecord,
    removeRecord,
    updateRecord,
    clearHistory,
    mounted,
  }
}
