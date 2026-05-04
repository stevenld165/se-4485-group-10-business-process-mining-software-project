"use client"

import styles from "./FileInput.module.css"
import { useState } from "react"
import { Button } from "./ui/button"
import { Field, FieldDescription } from "./ui/field"
import { Input } from "./ui/input"
import ErrorModal from "./ErrorModal"
import { useErrorModal } from "@/app/hooks/UseErrormodal"

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
  const {error, showError, clearError} = useErrorModal()

  const handleSubmit = () => {
    if (!file) {
      showError("Please select a file before submitting.")
      return
    }

    const extension = file.name.split(".").pop()?.toLowerCase()
    if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
      showError(`Unsupported file type. Please upload a .csv, .json, or .xml file.`)
      return
    }

    showError(null)
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
            showError(null)
            if (e.target.files && e.target.files.length > 0)
              setFile(e.target.files[0])
          }}
        />
        <FieldDescription>
          Upload a .csv, .json, or .xml file with your event log.
        </FieldDescription>
      </Field>

      <ErrorModal error={error} onClose={clearError} />
 
      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  )
}