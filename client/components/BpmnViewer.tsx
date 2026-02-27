"use client"

import { useEffect, useRef, useState } from "react"
import Modeler from "bpmn-js/lib/Modeler"
import "bpmn-js/dist/assets/diagram-js.css"
import "bpmn-font/dist/css/bpmn-embedded.css"

interface BpmnViewerProps {
  apiUrl: string // Your FastAPI endpoint URL
  algorithm?: "inductive" | "alpha" | "heuristics" // Optional algorithm parameter
}

export default function BpmnViewer({
  apiUrl,
  algorithm = "inductive",
}: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bpmnModeler, setBpmnModeler] = useState<Modeler | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize bpmn-js Modeler
  useEffect(() => {
    if (!containerRef.current) return

    // Create Modeler instance
    const modeler = new Modeler({
      container: containerRef.current,
    })

    setBpmnModeler(modeler)

    // Cleanup function
    return () => {
      modeler.destroy()
    }
  }, [])

  // Fetch BPMN from API and render
  const loadBpmnDiagram = async () => {
    if (!bpmnModeler) return

    setLoading(true)
    setError(null)

    try {
      // Construct API URL with algorithm parameter if needed
      const url = algorithm ? `${apiUrl}/${algorithm}` : apiUrl

      // Fetch BPMN XML from FastAPI
      const response = await fetch("http://127.0.0.1:8000/diagram")

      const bpmnXML = await response.text()

      // Import XML into bpmn-js
      await bpmnModeler.importXML(bpmnXML)

      // Optional: Fit diagram to view
      const canvas = bpmnModeler.get("canvas")
      canvas.zoom("fit-viewport")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load BPMN diagram",
      )
      console.error("Error loading BPMN:", err)
    } finally {
      setLoading(false)
    }
  }

  // Load diagram when modeler is ready
  useEffect(() => {
    if (bpmnModeler) {
      loadBpmnDiagram()
    }
  }, [bpmnModeler, apiUrl, algorithm])

  return (
    <div className='w-full h-full flex flex-col'>
      {/* Controls */}
      <div className='bg-white border-b p-4 flex gap-2'>
        <button
          onClick={loadBpmnDiagram}
          disabled={loading}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400'
        >
          {loading ? "Loading..." : "Refresh Diagram"}
        </button>

        {/* Optional: Download button */}
        <button
          onClick={async () => {
            try {
              const { xml } = await bpmnModeler!.saveXML({ format: true })
              const blob = new Blob([xml], { type: "application/xml" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = "diagram.bpmn"
              a.click()
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error("Failed to save diagram:", err)
            }
          }}
          className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
        >
          Download BPMN
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded'>
          {error}
        </div>
      )}

      {/* BPMN container */}
      <div
        ref={containerRef}
        className='flex-1 min-h-0 w-full bg-gray-50'
        style={{ height: "600px" }}
      />
    </div>
  )
}
