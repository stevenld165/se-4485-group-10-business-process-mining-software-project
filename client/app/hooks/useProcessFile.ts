"use client"

import { useState } from "react"
import { Entry } from "../event-logs/columns"

export const useProcessFile = () => {
  const [eventLogData, setEventLogData] = useState<Entry[]>([])
  const [bpmnXml, setBpmnXml] = useState<string>()

  const processFile = async (file: File): Promise<{ entries: Entry[]; xml: string } | null> => {
    if (!file || file.type != "text/csv") return null

    const formData = new FormData()
    formData.append("file", file)

    try {
      const eventLogResponse = await fetch("http://127.0.0.1:8000/event-log", {
        method: "POST",
        body: formData,
      })
      const eventLogJson = await eventLogResponse.json()
      const bpmnDiagramResponse = await fetch("http://127.0.0.1:8000/diagram", {
        method: "POST",
        body: formData,
      })

      const bpmnDiagramXml = await bpmnDiagramResponse.text()

      setEventLogData(eventLogJson)
      setBpmnXml(bpmnDiagramXml)
      return { entries: eventLogJson, xml: bpmnDiagramXml }
    } catch (error) {
      console.error(error)
      return null
    }
  }

  const loadFromRecord = (data: { entries: Entry[]; xml: string }) => {
    setEventLogData(data.entries)
    setBpmnXml(data.xml)
  }

  return {
    eventLogData,
    bpmnXml,
    processFile,
    loadFromRecord,
  }
}
