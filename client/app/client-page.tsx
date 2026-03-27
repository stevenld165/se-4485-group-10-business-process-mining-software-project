"use client"

import BpmnViewer from "@/components/BpmnViewer"
import Image from "next/image"
import { useState } from "react"

import { DataTable } from "./event-logs/data-table"
import { columns, Entry } from "./event-logs/columns"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import FileInput from "@/components/FileInput"
import { useProcessFile } from "./hooks/useProcessFile"

export default function ClientPage() {
  const { eventLogData, bpmnXml, processFile } = useProcessFile()
  const [isEventLogOpen, setIsEventLogOpen] = useState(true)

  const handleUploadFile = (file: File) => {
    processFile(file)
  }

  return (
    <div className='flex h-screen bg-zinc-50 font-sans dark:bg-black overflow-hidden'>
      {/* Fixed Header */}
      <header className='fixed top-0 left-0 z-20 w-full p-4 bg-white dark:bg-gray-800 shadow-sm border-b dark:border-zinc-800 flex items-center justify-between'>
        <h1 className='text-xl font-bold text-gray-800 dark:text-gray-200'>Process Mining Application</h1>
      </header>

      {/* Main Content: Split Screen */}
      <main className='flex w-full pt-16 h-full transition-all duration-300'>

        {/* LEFT COLUMN: Control Panel (Top) & BPMN Diagram (Bottom) */}
        <aside
          className={`flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 ${
            isEventLogOpen ? "w-2/3" : "w-full"
          }`}
        >
          {/* Top Left: Control Panel */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
            <FileInput onFileSubmit={handleUploadFile} />
          </div>

          {/* Bottom Left: BPMN Diagram */}
          <div className="flex-1 flex flex-col p-4 bg-zinc-50 dark:bg-black">
            <div className="flex items-center justify-between mb-2">
              <h2 className='text-lg font-bold'>BPMN Diagram</h2>

              {/* Toggle Event Log Button */}
              <button
                onClick={() => setIsEventLogOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label={isEventLogOpen ? "Close Event Log" : "Open Event Log"}
              >
                {isEventLogOpen ? (
                  <>
                    {/* Chevron Right to close */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hide Event Log
                  </>
                ) : (
                  <>
                    {/* Chevron Left to open */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Show Event Log
                  </>
                )}
              </button>
            </div>

            <div className='flex-1 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
              <div id='#canvas' className='w-full h-full'>
                <BpmnViewer xml={bpmnXml} />
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Event Log (Full Height) — collapses when hidden */}
        <section
          className={`flex flex-col bg-white dark:bg-black overflow-hidden transition-all duration-300 ${
            isEventLogOpen ? "flex-1 p-6 opacity-100" : "w-0 p-0 opacity-0 pointer-events-none"
          }`}
        >
          <h2 className='text-2xl font-bold mb-4 whitespace-nowrap'>Event Log</h2>
          <div className='flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
            <div className='h-full overflow-auto'>
              <DataTable columns={columns} data={eventLogData} />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}