import BpmnViewer from "@/components/BpmnViewer"
import Image from "next/image"

import { DataTable } from "./event-logs/data-table"
import { columns, Entry } from "./event-logs/columns"

const getEventLog = async (): Promise<Entry[]> => {
  const response = await fetch("http://127.0.0.1:8000/event-log")
  const data = await response.json()

  return data
}

export default async function Home() {
  const fetchDiagram = async () => {
    const data = await fetch("http://127.0.0.1:8000/diagram")
    console.log(data)
  }

  const eventLogData = await getEventLog()

  await fetchDiagram()

  return (
    <div className='flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black'>
      <main className='flex min-h-screen w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start'>
        <h1 className='text-3xl'>Process Mining Application</h1>
        <h2 className='text-2xl'>Event Log</h2>
        <div className='container max-h-128 overflow-y-scroll'>
          <DataTable columns={columns} data={eventLogData} />
        </div>

        <h2 className='mt-4 text-2xl'>BPMN Diagram</h2>
        <div id='#canvas' className='w-full h-[80vh]'>
          <BpmnViewer apiUrl='http://127.0.0.1:8000/graph' />
        </div>
      </main>
    </div>
  )
}
