"use client"

import { useEffect, useRef, useState } from "react"
import Modeler from "bpmn-js/lib/Modeler"
import "bpmn-js/dist/assets/diagram-js.css"
import "bpmn-font/dist/css/bpmn-embedded.css"
import { Button } from "./ui/button"

interface BpmnViewerProps {
  xml?: string
}

export default function BpmnViewer({ xml }: BpmnViewerProps) {
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
      if (!xml) return

      const bpmnXML = xml

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
  }, [bpmnModeler, xml])

  return (
    <div className='w-full h-full flex flex-col'>
      {/* Controls */}
      <div className='bg-white border-b p-4 flex gap-2'>
        <Button
          onClick={loadBpmnDiagram}
          disabled={loading}
          className='px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400'
        >
          {loading ? "Loading..." : "Refresh Diagram"}
        </Button>

        {/* Optional: Download button */}
        <Button
          onClick={async () => {
            try {
              const { svg } = await bpmnModeler!.saveSVG()
              const blob = new Blob([svg], { type: "image/svg+xml" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = "diagram.svg"
              a.click()
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error("Failed to save diagram:", err)
            }
          }}
          className='px-4 py-2 bg-green-500 text-white hover:bg-green-600'
        >
          Download Diagram
        </Button>
        <Button
          onClick={async () => {
            try {
              const { svg } = await bpmnModeler!.saveSVG()
              const blob = new Blob([svg], { type: "image/svg+xml" })

              const clipboardItem = new ClipboardItem({
                [blob.type]: blob,
              })

              await navigator.clipboard.write([clipboardItem])
            } catch (err) {
              console.error("Failed to save diagram:", err)
            }
          }}
          className='px-4 py-2 bg-green-500 text-white hover:bg-green-600'
        >
          Copy Diagram
        </Button>
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
