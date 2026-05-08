"use client"

import { useState, useCallback } from "react"
import type { ErrorInput } from "../../components/ErrorModal"

export function useErrorModal() {
  const [error, setError] = useState<ErrorInput>(null)

  const showError = useCallback((err: ErrorInput) => {
    setError(err)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return { error, showError, clearError }
}