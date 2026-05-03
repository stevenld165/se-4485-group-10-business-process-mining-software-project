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
import { start } from "repl"


interface BpmnViewerProps {
  xml?: string
}

export interface BpmnViewerHandle {
  highlightActivity: (activityName: string | null) => void
}

function injectLanes(
  xml: string,
  actorToActivities: Record<string, string[]>,
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")

  const BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL"
  const BPMNDI = "http://www.omg.org/spec/BPMN/20100524/DI"
  const DC = "http://www.omg.org/spec/DD/20100524/DC"

  const process = doc.getElementsByTagNameNS(BPMN, "process")[0]
  const plane = doc.getElementsByTagNameNS(BPMNDI, "BPMNPlane")[0]

  if (!process || !plane) return xml // nothing to do

  // Build activityName -> elementId from existing process children
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

  // Remove any stale laneSets
  Array.from(process.getElementsByTagNameNS(BPMN, "laneSet")).forEach((ls) =>
    ls.parentNode?.removeChild(ls),
  )

  // Build <laneSet>
  const laneSet = doc.createElementNS(BPMN, "laneSet")
  laneSet.setAttribute("id", "laneSet_1")

  Object.entries(actorToActivities).forEach(([actor, activities], idx) => {
    const laneId = `lane_${actor.replace(/\s+/g, "_")}`

    const lane = doc.createElementNS(BPMN, "lane")
    lane.setAttribute("id", laneId)
    lane.setAttribute("name", actor)

    activities.forEach((actName) => {
      const nodeId = nameToId[actName]
      if (!nodeId) return
      const ref = doc.createElementNS(BPMN, "flowNodeRef")
      ref.textContent = nodeId
      lane.appendChild(ref)
    })
    // Assign control nodes (start/end/gateway) that point to this lane's activities
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

      // Check if this control node points to any activity in this lane
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

      // Fallback: check incoming (for end events)
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

    // Placeholder BPMNShape for the lane (dagre will overwrite bounds)
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

  // Insert laneSet as first child of process
  process.insertBefore(laneSet, process.firstChild)

  return new XMLSerializer().serializeToString(doc)
}

/**
 * Runs a dagre compound layout over the live bpmn-js element registry and
 * writes positions back via the modeling API.
 *
 * Lanes become compound parent nodes; tasks/events/gateways are children.
 * Sequence flows become edges.
 */
async function applyDagreLayout(modeler: Modeler): Promise<void> {
  const NODESEP = 20
  const EDGESEP = 20
  const RANKSEP = 40

  // ── 1. Get raw moddle definitions (same as pm4py's approach) ──────────────
  const definitions = (modeler as any)._definitions
  const rootProcess = definitions.rootElements.find(
    (el: any) => el.$type === "bpmn:Process",
  )
  if (!rootProcess) return

  const flowElements: any[] = rootProcess.flowElements ?? []
  const planeElements: any[] = definitions.diagrams[0].plane.planeElement ?? []

  // Build index: bpmnElement.id -> index in planeElements
  const graphicalDict: Record<string, number> = {}
  const edgesDict: Record<string, string> = {} // "srcId@tgtId" -> sequenceFlow id

  planeElements.forEach((pe: any, i: number) => {
    const id = pe.bpmnElement?.id
    if (id) graphicalDict[id] = i
  })

  // ── 2. DFS from start event (same traversal as pm4py) ────────────────────
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
        // Record edge: "sourceId@targetId" -> flowId
        edgesDict[`${el.id}@${out.targetRef.id}`] = out.id
        if (!visited.includes(out.targetRef)) {
          toVisit.push(out.targetRef)
        }
      }
    }
  }

  // ── 3. Build lane membership map: nodeId -> laneId ───────────────────────
  const nodeToLane: Record<string, string> = {}
  const laneSets: any[] = rootProcess.laneSets ?? []
  laneSets.forEach((ls: any) => {
    ;(ls.lanes ?? []).forEach((lane: any) => {
      ;(lane.flowNodeRef ?? []).forEach((ref: any) => {
        nodeToLane[ref.id] = lane.id
      })
    })
  })
// ── Helper: run one dagre pass and return the graph ───────────────────────
  const lanes: any[] = laneSets.flatMap((ls: any) => ls.lanes ?? [])
  if(lanes.length === 0) {
    console.warn("No lanes found in BPMN diagram — skipping layout")
    return
  }
  
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

    // Add lane compound nodes — these get the forced dimensions on 2nd pass
    lanes.forEach((lane: any) => {
      const pe = planeElements[graphicalDict[lane.id]]
      const w = forcedLaneWidth ?? pe?.bounds?.width ?? 800
      const h = forcedLaneHeight ?? pe?.bounds?.height ?? 150

      console.log(w)
      g.setNode(lane.id, { label: lane.name ?? lane.id, width: w, height: h })
    })

    // Add flow nodes — always use their ORIGINAL bounds, never scale them
    const NODE_SCALE = 1.6  // increase to make tasks bigger; 1.0 = original size

    visited.forEach((el: any) => {
      const pe = planeElements[graphicalDict[el.id]]
      if (!pe?.bounds) return

      const isTask = el.$type?.toLowerCase().includes("task") || el.$type?.toLowerCase().includes("subprocess")
      const scale = isTask ? NODE_SCALE : 1.0

      g.setNode(el.id, {
        label: el.name ?? el.id,
        width: pe.bounds.width * scale,
        height: pe.bounds.height * scale,
      })

      const laneId = nodeToLane[el.id]
      if (laneId) g.setParent(el.id, laneId)
    })

    // Add edges
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

  // ── 4. First pass: measure how large dagre makes the lane containers ───────
  const g1 = runDagre()

  let maxLaneWidth = 0
  let maxLaneHeight = 0

  // Only measure lane nodes, not flow nodes
  lanes.forEach((lane: any) => {
    const n = g1.node(lane.id)
    if (!n) return
    maxLaneWidth = Math.max(maxLaneWidth, n.width)
    maxLaneHeight = Math.max(maxLaneHeight, n.height)
  })

  console.log(maxLaneWidth, maxLaneHeight)

  // ── 5. Second pass: expand lanes with pm4py's multipliers ─────────────────
  const safeWidth = maxLaneWidth > 0 ? maxLaneWidth * 1.5 : 800
  const safeHeight = maxLaneHeight > 0 ? maxLaneHeight * 1.5 : 150
  const g2 = runDagre(safeWidth, safeHeight)

  const targetWidth = maxLaneWidth * 1

  lanes.forEach((lane: any) => {
    const n = g2.node(lane.id)
    if (n) {
      const oldWidth = n.width
      n.width = targetWidth
      // Adjust x position to maintain centering
      n.x = n.x - (oldWidth - targetWidth) / 2
    }
  })
  
  const validLaneEdges = lanes .map((lane) => {
    const n = g2.node(lane.id)
    return n && isFinite(n.x) && isFinite(n.width) ? n.x - n.width / 2 : null
  })
  .filter((v): v is number => v !== null)

  if (validLaneEdges.length > 0) {
    const minEdge = Math.min(...validLaneEdges)
    lanes.forEach((lane) => {
      const n = g2.node(lane.id)
      if (!n) return
        const currentLeftEdge = n.x - n.width / 2
        n.x = n.x + (minEdge - currentLeftEdge)
    })
  }

  // ── 6. Write node positions back to moddle bounds ─────────────────────────
 g2.nodes().forEach((nodeId) => {
  const n = g2.node(nodeId)
  const idx = graphicalDict[nodeId]
  if (!n || idx === undefined) return

  const pe = planeElements[idx]
  if (!pe?.bounds) return

  const x = n.x - n.width / 2
  const y = n.y - n.height / 2

  // Guard: skip if dagre produced non-finite values
  if (!isFinite(x) || !isFinite(y) || !isFinite(n.width) || !isFinite(n.height)) {
    console.warn(`Skipping node ${nodeId} — non-finite bounds`, n)
    return
  }

  pe.bounds.x = x
  pe.bounds.y = y
  pe.bounds.width = n.width
  pe.bounds.height = n.height
})

  // ── 6b. Pin start event to a fixed left margin from the lane left edge ──────
const START_MARGIN = 40  // px gap between lane title bar and start event centre

const startEventEl = flowElements.find((n: any) =>
  n.$type?.toLowerCase().endsWith("startevent")
)

if (startEventEl) {
  const startIdx = graphicalDict[startEventEl.id]
  const startPe = startIdx !== undefined ? planeElements[startIdx] : null

  if (startPe?.bounds) {
      // Place the start event's left edge at laneLeftEdge + START_MARGIN
    startPe.bounds.x = Math.min(...validLaneEdges) + START_MARGIN
  }
}
  // ── 7. Write edge waypoints, cloning metadata from existing waypoints ──────
  // (same pattern as pm4py's CustomWaypoint clone)
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
      // Clone all moddle metadata from the reference waypoint
      // so the serializer doesn't reject the new points
      const wp: any = Object.create(Object.getPrototypeOf(referenceWp))
      Object.assign(wp, referenceWp)
      wp.x = p.x
      wp.y = p.y
      return wp
    })
  })

  // ── 8. Re-import the mutated XML to force bpmn-js to re-render ────────────
  const { xml: updatedXml } = await (modeler as any).saveXML({ format: false })
  await modeler.importXML(updatedXml)
}


// ── Icon helpers (keeps JSX clean) ────────────────────────────────────────────
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

// -------------------------------------------------------------------
const BpmnViewer = forwardRef(({ xml }: BpmnViewerProps, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bpmnModeler, setBpmnModeler] = useState<Modeler | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Initialize bpmn-js Modeler
  useEffect(() => {
    if (!containerRef.current) return

    // Create Modeler instance
    const modeler = new Modeler({
      container: containerRef.current,
      textRenderer: {
        defaultStyle: {
          fontFamily: "Arial, sans-serif",
          fontSize: "20px",
          fontWeight:"Bold",
        },
        externalStyle: {
          fontFamily: "Arial, sans-serif",
          fontSize: "20px",
          fontWeight:"Bold",
        },
      },
    })

    setBpmnModeler(modeler)

    //Subscribe to command stack changes for undo/redo state
    const updateUndoRedo = () => {
      const commandStack = modeler.get<any>("commandStack")
      setCanUndo(commandStack.canUndo())
      setCanRedo(commandStack.canRedo())
    }

    modeler.on("commandStack.changed", updateUndoRedo)

    // Cleanup function
    return () => {
      modeler.off("commandStack.changed", updateUndoRedo)
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

      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, "application/xml")
      const BPMN = "http://www.omg.org/spec/BPMN/20100524/MODEL"
      const processEl = doc.getElementsByTagNameNS(BPMN, "process")[0]
      const actorMapRaw = processEl?.getAttribute("data-actor-map")
      const actorToActivities: Record<string, string[]> = actorMapRaw
        ? JSON.parse(actorMapRaw)
        : {}

      const haslanes = Object.keys(actorToActivities).length > 0
      const enrichedXml =
        Object.keys(actorToActivities).length > 0
          ? injectLanes(xml, actorToActivities)
          : xml

      await bpmnModeler.importXML(enrichedXml)
      if (haslanes) {
        await applyDagreLayout(bpmnModeler)
        console.log("Applied custom layout with lanes")
      }
      

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

  // Load diagram when modeler is ready
  useEffect(() => {
    if (bpmnModeler) {
      loadBpmnDiagram()
    }
  }, [bpmnModeler, xml])

  // Undo/Redo via bpmn-js modeling API
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

      console.log("attempting to highlight: ", activityName)

      const elementRegistry = bpmnModeler.get<any>("elementRegistry")
      const canvas = bpmnModeler.get<any>("canvas")

      // Clear all previous highlights
      elementRegistry.getAll().forEach((el: any) => {
        if (el.type !== "bpmn:SequenceFlow") {
          canvas.removeMarker(el.id, "highlighted-node")
        }
      })

      if (!activityName) return

      // Find element(s) whose name matches the activity
      const matches = elementRegistry
        .getAll()
        .filter(
          (el: any) =>
            el.businessObject?.name === activityName &&
            el.type !== "bpmn:SequenceFlow",
        )

      matches.forEach((el: any) => {
        console.log(el)
        canvas.addMarker(el.id, "highlighted-node")
        // Scroll the element into view
        canvas.scrollToElement(el)
      })
    },
  }))

  //Toolbar separator helper
   const Sep = () => <div style={{ width: 1, height: 20, background: "#e5e7eb", margin: "0 4px" }} />
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
        {/* Zoom controls */}
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
        {/* Fit button */}
        <Button
          onClick={() => (bpmnModeler?.get("canvas") as any)?.zoom("fit-viewport", "auto")}
          disabled={!bpmnModeler}
          className='px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200'
        >
          Fit
        </Button>

        {/*Undo button */}
        <Button
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-40"
        >
          <UndoIcon />
          <span className="text-xs">Undo</span>
        </Button>
        {/*Redo Button */}
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
      />
    </div>
  )
})

BpmnViewer.displayName = "BpmnViewer"
export default BpmnViewer