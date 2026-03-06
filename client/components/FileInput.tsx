"use client"

import { useContext, useState } from "react"
import { Button } from "./ui/button"
import { Field, FieldDescription, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"

export default function FileInput({ onFileSubmit }) {
  const [file, setFile] = useState<File>()

  const handleSubmit = async () => {
    if (file?.type != "text/csv") return

    onFileSubmit(file)
  }

  return (
    <>
      <Field className='max-w-sm'>
        <FieldLabel htmlFor='event-log-input'>Upload event log</FieldLabel>
        <Input
          id='event-log-input'
          type='file'
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0)
              setFile(event.target.files[0])
          }}
        />
        <FieldDescription>
          Upload a .csv file with your event log.
        </FieldDescription>
      </Field>
      <Button onClick={handleSubmit}>Submit</Button>
    </>
  )
}
