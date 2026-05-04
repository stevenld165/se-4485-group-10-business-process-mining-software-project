"use client"

import { useState, useCallback } from "react"
import type { ErrorInput } from "../../components/ErrorModal"

/**
 * useErrorModal
 *
 * Thin hook that manages open/close state for the ErrorModal.
 * Use it in any component that needs to surface an error,
 * without threading props through the tree.
 *
 * Usage:
 *   const { error, showError, clearError } = useErrorModal()
 *   ...
 *   showError("Something went wrong")           // plain string
 *   showError({ kind: "network_error", message: "..." })  // ProcessError
 *   ...
 *   <ErrorModal error={error} onClose={clearError} />
 */
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