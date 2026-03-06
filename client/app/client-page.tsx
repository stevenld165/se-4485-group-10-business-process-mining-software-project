"use client"

import BpmnViewer from "@/components/BpmnViewer"
import Image from "next/image"

import { DataTable } from "./event-logs/data-table"
import { columns, Entry } from "./event-logs/columns"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import FileInput from "@/components/FileInput"
import { useProcessFile } from "./hooks/useProcessFile"

export default function ClientPage() {
  const { eventLogData, bpmnXml, processFile } = useProcessFile()

  const handleUploadFile = (file: File) => {
    processFile(file)
  }

  //const eventLogData = await getEventLog()

  return (
    <div className='flex h-screen bg-zinc-50 font-sans dark:bg-black overflow-hidden'>
      {/* Fixed Header */}
      <header className='fixed top-0 left-0 z-20 w-full p-4 bg-white dark:bg-gray-800 shadow-sm border-b dark:border-zinc-800'>
        <h1 className='text-xl font-bold text-gray-800 dark:text-gray-200'>Process Mining Application</h1>
      </header>

      {/* Main Content: Split Screen */}
      <main className='flex w-full pt-16 h-full'>
        
        {/* LEFT COLUMN: Control Panel (Top) & BPMN Diagram (Bottom) */}
        <aside className='flex w-2/3 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'>
          
          {/* Top Left: Control Panel */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
            <FileInput onFileSubmit={handleUploadFile} />
          </div>

          {/* Bottom Left: BPMN Diagram */}
          <div className="flex-1 flex flex-col p-4 bg-zinc-50 dark:bg-black">
            <h2 className='text-lg font-bold mb-2'>BPMN Diagram</h2>
            <div className='flex-1 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
              <div id='#canvas' className='w-full h-full'>
                <BpmnViewer xml={bpmnXml} />
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Event Log (Full Height) */}
        <section className='flex-1 flex flex-col p-6 bg-white dark:bg-black overflow-hidden'>
          <h2 className='text-2xl font-bold mb-4'>Event Log</h2>
          <div className='flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden'>
            {/* Scrollable Table Area */}
            <div className='h-full overflow-auto'>
              <DataTable columns={columns} data={eventLogData} />
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
