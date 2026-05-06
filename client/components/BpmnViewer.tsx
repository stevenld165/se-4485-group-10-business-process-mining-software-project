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
  onNodeClick?: (activityName: string) => void
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

  if (!process || !plane) return xml

  // ── 1. Build nameToId and idToElement from existing process children ────────
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

  // ── 2. Detect which activity names are shared across multiple actors ─────────
  // activityName -> list of actors that own it
  const activityActors: Record<string, string[]> = {}
  Object.entries(actorToActivities).forEach(([actor, activities]) => {
    activities.forEach((actName) => {
      if (!activityActors[actName]) activityActors[actName] = []
      activityActors[actName].push(actor)
    })
  })

  // ── 3. Clone shared nodes so each actor gets its own dedicated element ───────
  // actorActivityKey -> element id  (key = `${actor}||${actName}`)
  const actorActivityToId: Record<string, string> = {}

  // Helper: find the BPMNShape for a given element id
  const findShape = (elementId: string): Element | null => {
    return (
      Array.from(plane.children).find(
        (s) =>
          s.localName === "BPMNShape" &&
          s.getAttribute("bpmnElement") === elementId,
      ) ?? null
    )
  }

  Object.entries(actorToActivities).forEach(([actor, activities]) => {
    activities.forEach((actName) => {
      const owners = activityActors[actName]
      const originalId = nameToId[actName]
      if (!originalId) return

      if (owners.length === 1) {
        // Only one actor — no cloning needed, but rename to "[actName]\n[actor]"
        // so it's clear which lane owns it.
        const el = idToElement[originalId]
        if (el) el.setAttribute("name", `${actName}\n[${actor}]`)
        actorActivityToId[`${actor}||${actName}`] = originalId
        return
      }

      // Shared activity: first actor keeps the original element (renamed),
      // subsequent actors get clones with new IDs.
      const isFirst = owners[0] === actor

      if (isFirst) {
        // Rename the original
        const el = idToElement[originalId]
        if (el) el.setAttribute("name", `${actName}\n[${actor}]`)
        actorActivityToId[`${actor}||${actName}`] = originalId
      } else {
        // Clone the original process element
        const original = idToElement[originalId]
        if (!original) return

        const safeActor = actor.replace(/\s+/g, "_")
        const safeAct = actName.replace(/\s+/g, "_")
        const cloneId = `clone_${safeActor}_${safeAct}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

        const clone = original.cloneNode(true) as Element
        clone.setAttribute("id", cloneId)
        clone.setAttribute("name", `${actName}\n[${actor}]`)

        // Remove incoming/outgoing refs from the clone — they will be
        // re-wired below when we duplicate the sequence flows.
        Array.from(clone.children)
          .filter(
            (c) =>
              c.localName === "incoming" || c.localName === "outgoing",
          )
          .forEach((c) => clone.removeChild(c))

        process.appendChild(clone)
        idToElement[cloneId] = clone

        // Clone the BPMNShape so the element renders
        const origShape = findShape(originalId)
        if (origShape) {
          const cloneShape = origShape.cloneNode(true) as Element
          cloneShape.setAttribute("id", `${cloneId}_di`)
          cloneShape.setAttribute("bpmnElement", cloneId)
          plane.appendChild(cloneShape)
        }

        actorActivityToId[`${actor}||${actName}`] = cloneId
      }
    })
  })

  // ── 4. Duplicate sequence flows that connect to/from shared clones ───────────
  // For each clone, find the original's sequence flows and create mirrored flows
  // pointing to/from the clone instead.
  Object.entries(actorToActivities).forEach(([actor, activities]) => {
    activities.forEach((actName) => {
      const owners = activityActors[actName]
      if (owners.length <= 1 || owners[0] === actor) return // originals keep their flows

      const originalId = nameToId[actName]
      const cloneId = actorActivityToId[`${actor}||${actName}`]
      if (!originalId || !cloneId) return

      // Find all sequence flows touching the original
      Array.from(process.children)
        .filter((el) => el.localName === "sequenceFlow")
        .forEach((sf) => {
          const src = sf.getAttribute("sourceRef")
          const tgt = sf.getAttribute("targetRef")
          const sfId = sf.getAttribute("id")
          if (!sfId) return

          if (src === originalId || tgt === originalId) {
            const newSfId = `${sfId}_clone_${actor.replace(/\s+/g, "_")}`
            const newSf = sf.cloneNode(true) as Element
            newSf.setAttribute("id", newSfId)
            if (src === originalId) newSf.setAttribute("sourceRef", cloneId)
            if (tgt === originalId) newSf.setAttribute("targetRef", cloneId)
            process.appendChild(newSf)

            // Clone the BPMNEdge shape for the new flow
            const origEdge = Array.from(plane.children).find(
              (s) =>
                s.localName === "BPMNEdge" &&
                s.getAttribute("bpmnElement") === sfId,
            )
            if (origEdge) {
              const cloneEdge = origEdge.cloneNode(true) as Element
              cloneEdge.setAttribute("id", `${newSfId}_di`)
              cloneEdge.setAttribute("bpmnElement", newSfId)
              plane.appendChild(cloneEdge)
            }
          }
        })
    })
  })

  // ── 5. Remove stale laneSets ─────────────────────────────────────────────────
  Array.from(process.getElementsByTagNameNS(BPMN, "laneSet")).forEach((ls) =>
    ls.parentNode?.removeChild(ls),
  )

  // ── 6. Build <laneSet> — each lane references only its own element IDs ───────
  const laneSet = doc.createElementNS(BPMN, "laneSet")
  laneSet.setAttribute("id", "laneSet_1")

  let currentY = 0
  const LANE_HEIGHT = 150

  Object.entries(actorToActivities).forEach(([actor, activities]) => {
    const laneId = `lane_${actor.replace(/\s+/g, "_")}`

    const lane = doc.createElementNS(BPMN, "lane")
    lane.setAttribute("id", laneId)
    lane.setAttribute("name", actor)

    // Collect the element IDs that belong exclusively to this actor
    const assignedIds = new Set<string>()

    activities.forEach((actName) => {
      const nodeId = actorActivityToId[`${actor}||${actName}`] ?? nameToId[actName]
      if (!nodeId) return
      const ref = doc.createElementNS(BPMN, "flowNodeRef")
      ref.textContent = nodeId
      lane.appendChild(ref)
      assignedIds.add(nodeId)
    })

    // Assign control nodes (start/end/gateway) adjacent to this lane's activities
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

      // Check if this control node points to any activity in this lane (outgoing)
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
    bounds.setAttribute("y", String(currentY))
    bounds.setAttribute("width", "800")
    bounds.setAttribute("height", String(LANE_HEIGHT))
    currentY += LANE_HEIGHT
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
  const NODESEP = 30
  const EDGESEP = 20
  const RANKSEP = 60

  // ── 1. Get raw moddle definitions ────────────────────────────────────────
  const definitions = (modeler as any)._definitions
  const rootProcess = definitions.rootElements.find(
    (el: any) => el.$type === "bpmn:Process",
  )
  if (!rootProcess) return

  const flowElements: any[] = rootProcess.flowElements ?? []
  const laneSets: any[] = rootProcess.laneSets ?? []
  const planeElements: any[] = definitions.diagrams[0].plane.planeElement ?? []

  // Build index: bpmnElement.id -> index in planeElements
  const graphicalDict: Record<string, number> = {}
  const edgesDict: Record<string, string> = {}

  planeElements.forEach((pe: any, i: number) => {
    const id = pe.bpmnElement?.id
    if (id) graphicalDict[id] = i
  })

  // ── 2. Map Nodes to Lanes via Name Parsing ───────────────────────────────
  const nodeToLane: Record<string, string> = {}
  const visited = new Set<any>()
  const lanes: any[] = laneSets.flatMap((ls: any) => ls.lanes ?? [])

  if (lanes.length === 0) {
    console.warn("No lanes found in BPMN diagram — skipping layout")
    return
  }

  // Create a lookup to easily find a lane ID by its Actor Name
  const actorToLaneId: Record<string, string> = {}
  lanes.forEach((lane) => {
    if (lane.name) actorToLaneId[lane.name.trim()] = lane.id
  })

  flowElements.forEach((el: any) => {
    if (el.$type === "bpmn:SequenceFlow") {
      edgesDict[`${el.sourceRef?.id}@${el.targetRef?.id}`] = el.id
      return
    }

    let assignedLaneId: string | null = null

    // Strategy A: Parse the actor directly from the node's name (e.g., "Task\n[Trainer A]")
    if (el.name && el.name.includes("[")) {
      const match = el.name.match(/\[(.*?)\]/)
      if (match && match[1]) {
        const actorName = match[1].trim()
        if (actorToLaneId[actorName]) {
          assignedLaneId = actorToLaneId[actorName]
        }
      }
    }

    // Strategy B: Fallback to XML flowNodeRef (usually catches unnamed gateways/events)
    if (!assignedLaneId) {
      lanes.forEach((lane) => {
        const refs = lane.flowNodeRef ?? []
        if (refs.some((r: any) => r.id === el.id)) {
          assignedLaneId = lane.id
        }
      })
    }

    // Strategy C: Safety net. If an element is floating, pin it to the first lane
    // so Dagre doesn't break the layout.
    if (!assignedLaneId && lanes.length > 0) {
      assignedLaneId = lanes[0].id
    }

    if (assignedLaneId) {
      nodeToLane[el.id] = assignedLaneId
      visited.add(el)
    }
  })

  // ── 3. Run Dagre (Single Pass) ───────────────────────────────────────────
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: false })
  g.setGraph({
    rankdir: "LR",
    nodesep: NODESEP,
    edgesep: EDGESEP,
    ranksep: RANKSEP,
  })
  g.setDefaultEdgeLabel(() => ({}))

  // Add lanes WITHOUT forcing width/height. Dagre MUST calculate this 
  // dynamically based on the child nodes we put inside them.
  lanes.forEach((lane: any) => {
    g.setNode(lane.id, { label: lane.name ?? lane.id })
  })

  const NODE_SCALE = 1.6 

  visited.forEach((el: any) => {
    const idx = graphicalDict[el.id]
    const pe = idx !== undefined ? planeElements[idx] : null
    if (!pe?.bounds) return

    const isTask = el.$type?.toLowerCase().includes("task") || el.$type?.toLowerCase().includes("subprocess")
    const scale = isTask ? NODE_SCALE : 1.0

    g.setNode(el.id, {
      label: el.name ?? el.id,
      width: pe.bounds.width * scale,
      height: pe.bounds.height * scale,
    })

    // Establish the parent-child relationship so Dagre puts it in the lane box
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

  // ── 4. Post-Layout: Size & Position Lanes ────────────────────────────────  
  // 4a. Find the X boundaries of actual tasks/gateways
  let minTaskX = Infinity
  let maxTaskX = -Infinity

  visited.forEach((el: any) => {
    const isEvent = el.$type?.toLowerCase().includes("event")
    if (!isEvent) {
      const n = g.node(el.id)
      if (n && isFinite(n.x)) {
        minTaskX = Math.min(minTaskX, n.x)
        maxTaskX = Math.max(maxTaskX, n.x)
      }
    }
  })

  if (minTaskX === Infinity) minTaskX = 100
  if (maxTaskX === -Infinity) maxTaskX = 500

  // 4b. Pin Start/End Events to the absolute edges and center them vertically 
  // in the first lane (Dagre sometimes floats them above if routing is complex)
  const firstLaneId = lanes.length > 0 ? lanes[0].id : null
  const firstLaneDagreNode = firstLaneId ? g.node(firstLaneId) : null

  visited.forEach((el: any) => {
    const n = g.node(el.id)
    if (!n) return

    if (el.$type?.toLowerCase().includes("startevent")) {
      n.x = minTaskX - 120  // Push left of the first task
      if (firstLaneDagreNode) n.y = firstLaneDagreNode.y 
    } 
    else if (el.$type?.toLowerCase().includes("endevent")) {
      n.x = maxTaskX + 120  // Push right of the last task
      if (firstLaneDagreNode) n.y = firstLaneDagreNode.y
    }
  })

  // 4c. Find the global bounding box of ALL flow nodes to size the lanes
  let minChildX = Infinity
  let maxChildX = -Infinity

  visited.forEach((el: any) => {
    const n = g.node(el.id)
    if (n && isFinite(n.x) && isFinite(n.width)) {
      minChildX = Math.min(minChildX, n.x - n.width / 2)
      maxChildX = Math.max(maxChildX, n.x + n.width / 2)
    }
  })

  if (minChildX === Infinity) minChildX = 0
  if (maxChildX === -Infinity) maxChildX = 800

  // 4d. Standardize lane width and position based on the children's spread
  const paddingX = 60 // Generous padding so nodes don't touch borders
  const laneLeftEdge = minChildX - paddingX
  const targetWidth = (maxChildX - minChildX) + (paddingX * 2)
  const targetCenterX = laneLeftEdge + targetWidth / 2

  const laneChildren: Record<string, string[]> = {}
  let laneY = 0
  const laneSpacing = 10 

  lanes.forEach((lane: any) => {
    laneChildren[lane.id] = (g.children(lane.id) as string[] | undefined) ?? []
    const n = g.node(lane.id)
    if (!n) return

    // Lock all lanes to the exact same X and Width
    n.width = targetWidth
    n.x = targetCenterX

    // Stack lanes vertically
    n.height = Math.max(n.height, 120) + 40 // Ensure a minimum height for visibility
    const newCenterY = laneY + n.height / 2
    const deltaY = newCenterY - n.y
    n.y = newCenterY

    // Shift children ONLY on the Y-axis. 
    // Leaving their X-axis alone preserves Dagre's perfect vertical columns!
    ;(laneChildren[lane.id] ?? []).forEach((childId: string) => {
      const cn = g.node(childId)
      if (cn && isFinite(cn.y)) cn.y += deltaY
    })

    laneY += n.height + laneSpacing
  })
  // ── 5. Write bounds back to Moddle elements ───────────────────────────────
  g.nodes().forEach((nodeId) => {
    const n = g.node(nodeId)
    const idx = graphicalDict[nodeId]
    if (!n || idx === undefined) return

    const pe = planeElements[idx]
    if (!pe?.bounds) return

    const x = n.x - n.width / 2
    const y = n.y - n.height / 2

    if (!isFinite(x) || !isFinite(y) || !isFinite(n.width) || !isFinite(n.height)) return

    pe.bounds.x = x
    pe.bounds.y = y
    pe.bounds.width = n.width
    pe.bounds.height = n.height
  })

  // ── 6. Write edge waypoints ──────────────────────────────────────────────
  g.edges().forEach((edgeObj) => {
    const key = `${edgeObj.v}@${edgeObj.w}`
    const flowId = edgesDict[key]
    const idx = graphicalDict[flowId]
    if (flowId === undefined || idx === undefined) return

    const pe = planeElements[idx]
    const referenceWp = pe?.waypoint?.[0]
    if (!pe || !referenceWp) return

    const srcNode = g.node(edgeObj.v)
    const tgtNode = g.node(edgeObj.w)
    if (!srcNode || !tgtNode) return

    const makeWp = (x: number, y: number) => {
      const wp: any = Object.create(Object.getPrototypeOf(referenceWp))
      Object.assign(wp, referenceWp)
      wp.x = x
      wp.y = y
      return wp
    }

    // Determine if the flow is moving forward (left-to-right) or backward
    const isForward = tgtNode.x >= srcNode.x

    // Connect to the correct faces:
    // If forward: exit right face of source, enter left face of target.
    // If backward: exit left face of source, enter right face of target.
    const srcX = srcNode.x + (isForward ? srcNode.width / 2 : -srcNode.width / 2)
    const tgtX = tgtNode.x + (isForward ? -tgtNode.width / 2 : tgtNode.width / 2)
    
    const srcY = srcNode.y
    const tgtY = tgtNode.y

    if (Math.abs(srcY - tgtY) < 10) {
      // Nodes are on the same horizontal plane — straight line
      pe.waypoint = [makeWp(srcX, srcY), makeWp(tgtX, tgtY)]
    } else {
      // Nodes are on different horizontal planes (e.g., crossing lanes)
      // Create a mid-point elbow that safely drops between the two shapes
      // rather than overlapping the swimlane borders.
      const midX = isForward 
          ? srcX + Math.max(15, (tgtX - srcX) / 2)
          : srcX - Math.max(15, (srcX - tgtX) / 2)
          
      pe.waypoint = [
        makeWp(srcX, srcY),
        makeWp(midX, srcY),
        makeWp(midX, tgtY),
        makeWp(tgtX, tgtY),
      ]
    }
  })

  // ── 7. Re-import the mutated XML to force bpmn-js to re-render ────────────
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
const BpmnViewer = forwardRef(({ xml, onNodeClick }: BpmnViewerProps, ref) => {
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
    modeler.on("element.click", (e: any) => {
      const element = e.element
      if (element.type != "bpmn:Process" &&
        element.type !== "bpmn:SequenceFlow" &&
        element.type !== "bpmn:Lane"){
          const activityName = element.businessObject?.name
          if(activityName && onNodeClick) {
            onNodeClick(activityName)
          }
        }
    })
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
      const actorMapRaw = processEl?.getAttribute("data-role-map")
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
        const viewbox = canvas.viewbox()

        canvas.viewbox({
          x: el.x - viewbox.width / 2 + (el.width / 2 || 0),
          y: el.y - viewbox.height / 2 + (el.height / 2 || 0),
          width: viewbox.width,
          height: viewbox.height,
        })
      })
    },
  }))

  return (
    <div className='w-full h-full flex flex-col'>
      <style>{`
        .highlighted-node:not(.djs-connection) .djs-visual > :nth-child(1) {
          fill: #dbeafe !important;       /* Light blue background */
          stroke: #2563eb !important;     /* Dark blue border */
          stroke-width: 4px !important;   /* Thicker border */
        }
      `}</style>
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