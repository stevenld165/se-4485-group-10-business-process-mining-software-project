"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import Modeler from "bpmn-js/lib/Modeler"
import "bpmn-js/dist/assets/diagram-js.css"
import "bpmn-font/dist/css/bpmn-embedded.css"
import "bpmn-js/dist/assets/bpmn-js.css"
import { Button } from "./ui/button"

import dagre from "dagre"

interface BpmnViewerProps {
  xml?: string
}

export interface BpmnViewerHandle {
  highlightActivity: (activityName: string | null) => void
}

function injectLanes(
  xml: string,
  roleToActivities: Record<string, string[]>,
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL"
  const BPMNDI = "http://www.omg.org/spec/BPMN/20100524/DI"
  const DC = "http://www.omg.org/spec/DD/20100524/DC"

  const process = doc.getElementsByTagNameNS(BPMN, "process")[0]
  const plane = doc.getElementsByTagNameNS(BPMNDI, "BPMNPlane")[0]

  if (!process || !plane) return xml

  const nameToId: Record<string, string> = {}
  const idToElement: Record<string, Element> = {}
  Array.from(process.children).forEach((el) => {
    const name = el.getAttribute("name")
    const id = el.getAttribute("id")
    if (name && id) {
      nameToId[name] = id
      idToElement[id] = el
    }
  })

  Array.from(process.getElementsByTagNameNS(BPMN, "laneSet")).forEach((ls) =>
    ls.parentNode?.removeChild(ls),
  )

  const laneSet = doc.createElementNS(BPMN, "laneSet")
  laneSet.setAttribute("id", "laneSet_1")

  Object.entries(roleToActivities).forEach(([role, activities]) => {
    const laneId = `lane_${role.replace(/\s+/g, "_")}`

    const lane = doc.createElementNS(BPMN, "lane")
    lane.setAttribute("id", laneId)
    lane.setAttribute("name", role)

    activities.forEach((actName) => {
      const nodeId = nameToId[actName]
      if (!nodeId) return
      const ref = doc.createElementNS(BPMN, "flowNodeRef")
      ref.textContent = nodeId
      lane.appendChild(ref)
    })

    const assignedIds = new Set(
      activities.map((a) => nameToId[a]).filter(Boolean),
    )

    Array.from(process.children).forEach((el) => {
      const id = el.getAttribute("id")
      if (!id || assignedIds.has(id)) return

      const localName = el.localName.toLowerCase()
      const isControlNode =
        localName.includes("startevent") ||
        localName.includes("endevent") ||
        localName.includes("gateway") ||
        localName.includes("intermediatecatch") ||
        localName.includes("intermediatethrow")

      if (!isControlNode) return

      const outgoing = Array.from(process.children).filter(
        (sf) =>
          sf.localName.toLowerCase().includes("sequenceflow") &&
          sf.getAttribute("sourceRef") === id,
      )

      for (const sf of outgoing) {
        const targetId = sf.getAttribute("targetRef")
        if (targetId && assignedIds.has(targetId)) {
          const ref = doc.createElementNS(BPMN, "flowNodeRef")
          ref.textContent = id
          lane.appendChild(ref)
          assignedIds.add(id)
          break
        }
      }

      if (!assignedIds.has(id)) {
        const incoming = Array.from(process.children).filter(
          (sf) =>
            sf.localName === "sequenceFlow" &&
            sf.getAttribute("targetRef") === id,
        )
        for (const sf of incoming) {
          const sourceId = sf.getAttribute("sourceRef")
          if (sourceId && assignedIds.has(sourceId)) {
            const ref = doc.createElementNS(BPMN, "flowNodeRef")
            ref.textContent = id
            lane.appendChild(ref)
            assignedIds.add(id)
            break
          }
        }
      }
    })
    laneSet.appendChild(lane)

    const shape = doc.createElementNS(BPMNDI, "BPMNShape")
    shape.setAttribute("id", `${laneId}_di`)
    shape.setAttribute("bpmnElement", laneId)
    shape.setAttribute("isHorizontal", "true")

    const bounds = doc.createElementNS(DC, "Bounds")
    bounds.setAttribute("x", "0")
    bounds.setAttribute("y", "0")
    bounds.setAttribute("width", "800")
    bounds.setAttribute("height", "150")
    shape.appendChild(bounds)
    plane.insertBefore(shape, plane.firstChild)
  })

  process.insertBefore(laneSet, process.firstChild)

  return new XMLSerializer().serializeToString(doc)
}

async function applyDagreLayout(modeler: Modeler): Promise<void> {
  // ── Spacing constants ─────────────────────────────────────────────────────
  const NODESEP = 20         
  const EDGESEP = 20          
  const RANKSEP = 40          

  const definitions = (modeler as any)._definitions
  const rootProcess = definitions.rootElements.find(
    (el: any) => el.$type === "bpmn:Process",
  )
  if (!rootProcess) return

  const flowElements: any[] = rootProcess.flowElements ?? []
  const planeElements: any[] = definitions.diagrams[0].plane.planeElement ?? []

  const graphicalDict: Record<string, number> = {}
  const edgesDict: Record<string, string> = {}

  planeElements.forEach((pe: any, i: number) => {
    const id = pe.bpmnElement?.id
    if (id) graphicalDict[id] = i
  })

  const startEvent = flowElements.find((n: any) =>
    n.$type?.toLowerCase().endsWith("startevent"),
  )
  if (!startEvent) return

  const visited: any[] = []
  const toVisit: any[] = [startEvent]

  while (toVisit.length > 0) {
    const el = toVisit.pop()
    if (!visited.includes(el)) visited.push(el)
    if (el.outgoing) {
      for (const out of el.outgoing) {
        edgesDict[`${el.id}@${out.targetRef.id}`] = out.id
        if (!visited.includes(out.targetRef)) {
          toVisit.push(out.targetRef)
        }
      }
    }
  }

  const nodeToLane: Record<string, string> = {}
  const laneSets: any[] = rootProcess.laneSets ?? []
  laneSets.forEach((ls: any) => {
    ;(ls.lanes ?? []).forEach((lane: any) => {
      ;(lane.flowNodeRef ?? []).forEach((ref: any) => {
        nodeToLane[ref.id] = lane.id
      })
    })
  })

  const lanes: any[] = laneSets.flatMap((ls: any) => ls.lanes ?? [])

  const runDagre = (
    forcedLaneWidth?: number,
    forcedLaneHeight?: number,
  ): dagre.graphlib.Graph => {
    const g = new dagre.graphlib.Graph({ compound: true, multigraph: false })
    g.setGraph({
      rankdir: "LR",
      nodesep: NODESEP,
      edgesep: EDGESEP,
      ranksep: RANKSEP,
    })
    g.setDefaultEdgeLabel(() => ({}))

    lanes.forEach((lane: any) => {
      const pe = planeElements[graphicalDict[lane.id]]
      const w = forcedLaneWidth ?? pe?.bounds?.width ?? 800
      const h = forcedLaneHeight ?? pe?.bounds?.height ?? 150
      g.setNode(lane.id, { label: lane.name ?? lane.id, width: w, height: h })
    })

    visited.forEach((el: any) => {
      const pe = planeElements[graphicalDict[el.id]]
      if (!pe?.bounds) return

      const isTask = el.$type?.toLowerCase().includes("task")
      const scale = isTask ? 1.7 : 1.2

      g.setNode(el.id, {
        label: el.name ?? el.id,
        width: pe.bounds.width * scale,
        height: pe.bounds.height * scale,
      })

      const laneId = nodeToLane[el.id]
      if (laneId) g.setParent(el.id, laneId)
    })

    flowElements
      .filter((el: any) => el.$type === "bpmn:SequenceFlow")
      .forEach((flow: any) => {
        const src = flow.sourceRef?.id
        const tgt = flow.targetRef?.id
        if (src && tgt && g.hasNode(src) && g.hasNode(tgt)) {
          g.setEdge(src, tgt, { id: flow.id })
        }
      })

    dagre.layout(g)
    return g
  }

  const g1 = runDagre()

  let maxLaneWidth = 0
  let maxLaneHeight = 0

  lanes.forEach((lane: any) => {
    const n = g1.node(lane.id)
    if (!n) return
    maxLaneWidth = Math.max(maxLaneWidth, n.width)
    maxLaneHeight = Math.max(maxLaneHeight, n.height)
  })

  // ── Lane size multipliers ─────────────────────────────────────────────────
  const g2 = runDagre(maxLaneWidth * 1.6, maxLaneHeight * 2)
  const targetWidth = maxLaneWidth * 1

  lanes.forEach((lane: any) => {
    const n = g2.node(lane.id)
    if (n) {
      const oldWidth = n.width
      n.width = targetWidth
      n.x = n.x - (oldWidth - targetWidth) / 2
    }
  })

  const minLeftEdge = Math.min(
    ...lanes.map((lane) => {
      const n = g2.node(lane.id)
      return n.x - n.width / 2
    }),
  )
  // --- FIXED LEFT PADDING LOGIC ---
  const HEADER_WIDTH = 30; 
  const DESIRED_GAP = 10; 
  const LEFT_PADDING = HEADER_WIDTH + DESIRED_GAP;

  lanes.forEach((lane) => {
    const n = g2.node(lane.id)
    const oldWidth = n.width
    const currentLeftEdge = n.x - oldWidth / 2
    const shift = minLeftEdge - currentLeftEdge
    
    n.x = n.x + shift
    n.width = n.width + LEFT_PADDING
    n.x = n.x - (LEFT_PADDING / 2)
  })
  
  // --- STACK LANES FLUSH (REMOVES ALL GAPS) ---
  lanes.forEach((lane) => {
    const n = g2.node(lane.id)
    const oldWidth = n.width
    const currentLeftEdge = n.x - oldWidth / 2
    const shift = minLeftEdge - currentLeftEdge
    n.x = n.x + shift
  })

  g2.nodes().forEach((nodeId) => {
    const n = g2.node(nodeId)
    const idx = graphicalDict[nodeId]
    if (!n || idx === undefined) return

    const pe = planeElements[idx]
    if (!pe?.bounds) return

    pe.bounds.x = n.x - n.width / 2
    pe.bounds.y = n.y - n.height / 2
    pe.bounds.width = n.width
    pe.bounds.height = n.height
  })

  g2.edges().forEach((edgeObj) => {
    const key = `${edgeObj.v}@${edgeObj.w}`
    const flowId = edgesDict[key]
    const idx = graphicalDict[flowId]
    if (flowId === undefined || idx === undefined) return

    const pe = planeElements[idx]
    const edgeData = g2.edge(edgeObj)
    const referenceWp = pe?.waypoint?.[0]
    if (!pe || !edgeData?.points || !referenceWp) return

    pe.waypoint = edgeData.points.map((p: { x: number; y: number }) => {
      const wp: any = Object.create(Object.getPrototypeOf(referenceWp))
      Object.assign(wp, referenceWp)
      wp.x = p.x
      wp.y = p.y
      return wp
    })
  })

  const { xml: updatedXml } = await (modeler as any).saveXML({ format: false })
  await modeler.importXML(updatedXml)
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14">
      <path d="M3 7H11a3 3 0 0 1 0 6H8" />
      <path d="M6 4L3 7l3 3" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14">
      <path d="M13 7H5a3 3 0 0 0 0 6h3" />
      <path d="M10 4l3 3-3 3" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
const BpmnViewer = forwardRef(({ xml }: BpmnViewerProps, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bpmnModeler, setBpmnModeler] = useState<Modeler | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const modeler = new Modeler({
      container: containerRef.current,
      // ── LARGER TEXT: override the default label font size ─────────────────
      textRenderer: {
        defaultStyle: {
          fontFamily: "inherit",
          fontSize: "20px",   
          fontWeight: "500",
        },
        externalStyle: {
          fontSize: "20px",
          fontWeight: "500",
        },
      },
    })

    setBpmnModeler(modeler)

    const updateUndoRedo = () => {
      const commandStack = modeler.get<any>("commandStack")
      setCanUndo(commandStack.canUndo())
      setCanRedo(commandStack.canRedo())
    }

    modeler.on("commandStack.changed", updateUndoRedo)

    return () => {
      modeler.off("commandStack.changed", updateUndoRedo)
      modeler.destroy()
    }
  }, [])

  const loadBpmnDiagram = async () => {
    if (!bpmnModeler) return

    setLoading(true)
    setError(null)

    try {
      if (!xml) return

      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, "application/xml")
      const BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL"
      const processEl = doc.getElementsByTagNameNS(BPMN, "process")[0]
      const roleMapRaw = processEl?.getAttribute("data-role-map")
      const roleToActivities: Record<string, string[]> = roleMapRaw
        ? JSON.parse(roleMapRaw)
        : {}

      const enrichedXml =
        Object.keys(roleToActivities).length > 0
          ? injectLanes(xml, roleToActivities)
          : xml

      await bpmnModeler.importXML(enrichedXml)
      await applyDagreLayout(bpmnModeler)

      const canvas = bpmnModeler.get("canvas") as any
      const elementRegistry = bpmnModeler.get("elementRegistry") as any

      // Get all start events (usually just one)
      const startEvents = elementRegistry.filter(
        (element: any) => element.type === "bpmn:StartEvent"
      )

      if (startEvents.length > 0) {
        const startNode = startEvents[0]
        

        canvas.zoom(1.2)

        // 2. Get the updated viewbox size after zooming
        const viewbox = canvas.viewbox()
        const horizontalOffset = viewbox.width * 0.25;
        const verticalOffset = viewbox.height * 0.5;

        // 3. Calculate new X and Y to center the screen on the start node
        viewbox.x = startNode.x - horizontalOffset / 2 + (startNode.width / 2 || 0)
        viewbox.y = startNode.y - verticalOffset / 2 + (startNode.height / 2 || 0)

        // 4. Apply the centered viewbox
        canvas.viewbox(viewbox)
      } else {
        // Fallback: If no start event exists, just fit the whole viewport
        canvas.zoom("fit-viewport", "auto")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load BPMN diagram",
      )
      console.error("Error loading BPMN:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (bpmnModeler) {
      loadBpmnDiagram()
    }
  }, [bpmnModeler, xml])

  const handleUndo = () => {
    if (!bpmnModeler) return
    const commandStack = bpmnModeler.get<any>("commandStack")
    if (commandStack.canUndo()) commandStack.undo()
  }

  const handleRedo = () => {
    if (!bpmnModeler) return
    const commandStack = bpmnModeler.get<any>("commandStack")
    if (commandStack.canRedo()) commandStack.redo()
  }

  useImperativeHandle(ref, () => ({
    highlightActivity: (activityName: string | null) => {
      if (!bpmnModeler) return

      const elementRegistry = bpmnModeler.get<any>("elementRegistry")
      const canvas = bpmnModeler.get<any>("canvas")

      elementRegistry.getAll().forEach((el: any) => {
        if (el.type !== "bpmn:SequenceFlow") {
          canvas.removeMarker(el.id, "highlighted-node")
        }
      })

      if (!activityName) return

      const matches = elementRegistry
        .getAll()
        .filter(
          (el: any) =>
            el.businessObject?.name === activityName &&
            el.type !== "bpmn:SequenceFlow",
        )

      matches.forEach((el: any) => {
        canvas.addMarker(el.id, "highlighted-node")
        canvas.scrollToElement(el)
      })
    },
  }))

  return (
    <div className='w-full h-full flex flex-col'>
      {/* Toolbar */}
      <div className='bg-white border-b p-4 flex gap-2'>
        <Button
          onClick={loadBpmnDiagram}
          disabled={loading}
          className='px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400'
        >
          {loading ? "Loading..." : "Refresh Diagram"}
        </Button>

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
              const clipboardItem = new ClipboardItem({ [blob.type]: blob })
              await navigator.clipboard.write([clipboardItem])
            } catch (err) {
              console.error("Failed to copy diagram:", err)
            }
          }}
          className='px-4 py-2 bg-green-500 text-white hover:bg-green-600'
        >
          Copy Diagram
        </Button>

        <Button
          onClick={() => (bpmnModeler?.get("zoomScroll") as any)?.stepZoom(1)}
          disabled={!bpmnModeler}
          className='px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200'
        >
          +
        </Button>

        <Button
          onClick={() => (bpmnModeler?.get("zoomScroll") as any)?.stepZoom(-1)}
          disabled={!bpmnModeler}
          className='px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200'
        >
          -
        </Button>

        <Button
          onClick={() => (bpmnModeler?.get("canvas") as any)?.zoom("fit-viewport", "auto")}
          disabled={!bpmnModeler}
          className='px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200'
        >
          Fit
        </Button>

        <Button
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
        >
          <UndoIcon />
          <span className="text-xs">Undo</span>
        </Button>

        <Button
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
        >
          <RedoIcon />
          <span className="text-xs">Redo</span>
        </Button>
      </div>

      {error && (
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded'>
          {error}
        </div>
      )}

      {/* BPMN canvas */}
      <div
        ref={containerRef}
        className='flex-1 min-h-0 w-full bg-gray-50'
      />
    </div>
  )
})

BpmnViewer.displayName = "BpmnViewer"
export default BpmnViewer