"use client"

import styles from "./FileInput.module.css"
import { useState } from "react"
import { Button } from "./ui/button"
import { Field, FieldDescription } from "./ui/field"
import { Input } from "./ui/input"

interface FileInputProps {
  onFileSubmit: (file: File) => void
}

const ACCEPTED_EXTENSIONS = ["csv", "json", "xml"]
const ACCEPTED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/json",
  "text/json",
  "application/xml",
  "text/xml",
].join(",")

export default function FileInput({ onFileSubmit }: FileInputProps) {
  const [file, setFile] = useState<File | undefined>()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!file) {
      setError("Please select a file before submitting.")
      return
    }

    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
      setError(`Unsupported file type. Please upload a .csv, .json, or .xml file.`)
      return
    }

    setError(null)
    onFileSubmit(file)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Upload Event Log</h1>
      <Field className="max-w-sm">
        <Input
          id="event-log-input"
          type="file"
          accept={`.csv,.json,.xml,${ACCEPTED_MIME_TYPES}`}
          className={styles.fileInput}
          onChange={(e) => {
            setError(null)
            if (e.target.files && e.target.files.length > 0)
              setFile(e.target.files[0])
          }}
        />
        <FieldDescription>
          Upload a .csv, .json, or .xml file with your event log.
        </FieldDescription>
      </Field>

      {error && (
        <p style={{ color: "#c53030", fontSize: "0.875rem" }}>{error}</p>
      )}

      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  )
}