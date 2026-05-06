from abc import ABC, abstractmethod
from pathlib import Path
import json
import xml.etree.ElementTree as ET
import re
from collections import deque

from pm4py import BPMN

from Writers import WriterFactory
from Readers import ReaderFactory
from FormatConversion import ConverterFactory


class BPMNGraph(ABC):

  @abstractmethod
  def read_graph(self) -> str:
    pass

  @abstractmethod
  def write_graph(self, file_location: str, file_contents: str, object_id: str, file_type: str, role_map: dict) -> None:
    pass


class SwimlaneDiagram(BPMNGraph):
  def __init__(self, file_type: str = 'bpmn', contents: BPMN = None, location: Path = None):
    self._file_contents = contents
    self.file_location = location
    self._file_type = file_type
    self.file_writer = WriterFactory.create_writer('bpmn')
    self.file_reader = ReaderFactory.create_reader('bpmn')
    self.byte_converter = ConverterFactory.create_byte_converter('bpmn')

  def read_graph(self) -> bytes:
    return self.byte_converter.convert_to(
      self.file_reader.read_file(self.file_location)
    )

  def write_graph(self, file_location: Path, file_contents: BPMN, object_id: str, file_type: str, role_map: dict) -> None:
    new_location = self.file_writer.write_to_file(file_location, file_contents, object_id, file_type)
    self._add_role_map(role_map, new_location, file_contents)
    self._layout_by_process_flow(new_location)
    self._reposition_gateways(new_location)
    self._reroute_long_flows(new_location)
    self.file_contents = file_contents
    self.file_location = new_location

  def _add_role_map(self, role_map: dict, path: Path, bpmn_graph: BPMN) -> None:
    if not role_map and not bpmn_graph:
      return
    enhanced_role_map = self._extract_actor_assignments(bpmn_graph)

    if role_map:
      for actor, activities in role_map.items():
        if actor not in enhanced_role_map:
          enhanced_role_map[actor] = activities

    role_map_json = json.dumps({
      role: list(activities) if isinstance(activities, set) else activities
      for role, activities in enhanced_role_map.items()
    })
    tree = ET.parse(str(path))
    root = tree.getroot()
    self._associate_tasks_to_lanes(root)
    bpmn_ns = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
    process_el = root.find(f'{{{bpmn_ns}}}process')
    if process_el is not None:
      process_el.set('data-role-map', role_map_json)
    tree.write(str(path), xml_declaration=True, encoding='utf-8')

  def _extract_actor_assignments(self, bpmn_graph: BPMN) -> dict:
    actor_tasks = {}
    pattern = r'\s*\[(.+?)\]\s*$'  # Matches "[Actor]" at end of string

    try:
      nodes = bpmn_graph.get_nodes() if hasattr(bpmn_graph, 'get_nodes') else []

      for node in nodes:
        if node.__class__.__name__ == 'Task':
          task_name = node.name if hasattr(node, 'name') else str(node)
          match = re.search(pattern, task_name)

          if match:
            actor = match.group(1)
            activity_base = re.sub(pattern, '', task_name).strip()

            if actor not in actor_tasks:
              actor_tasks[actor] = []
            actor_tasks[actor].append(activity_base)

    except Exception as e:
      pass

    return actor_tasks

  def _associate_tasks_to_lanes(self, root) -> None:
    bpmn_ns = "http://www.omg.org/spec/BPMN/20100524/MODEL"
    ns = {"bpmn": bpmn_ns}
    process_el = root.find("bpmn:process", ns)
    if process_el is None:
      return

    lane_set = process_el.find("bpmn:laneSet", ns)

    if lane_set is None:
      lane_set = ET.SubElement(
        process_el,
        f"{{{bpmn_ns}}}laneSet",
        {"id": "LaneSet_1"}
      )
    lane_map = {}

    for lane in lane_set.findall("bpmn:lane", ns):
      lane_name = lane.attrib.get("name")

      if lane_name:
        lane_map[lane_name] = lane

    for task in process_el.findall("bpmn:task", ns):

      task_id = task.attrib.get("id")
      task_name = task.attrib.get("name", "")

      match = re.search(r"\[(.+?)\]", task_name)

      if not match:
        continue

      actor = match.group(1).strip()

      if actor not in lane_map:
        lane = ET.SubElement(
          lane_set,
          f"{{{bpmn_ns}}}lane",
          {
            "id": f"lane_{actor}",
            "name": actor
          }
        )
        lane_map[actor] = lane

      flow_node_ref = ET.SubElement(
        lane_map[actor],
        f"{{{bpmn_ns}}}flowNodeRef"
      )

      flow_node_ref.text = task_id

  def _reposition_gateways(self, path: Path) -> None:
    ET.register_namespace('', 'http://www.omg.org/spec/BPMN/20100524/MODEL')
    ET.register_namespace('bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI')
    ET.register_namespace('dc', 'http://www.omg.org/spec/DD/20100524/DC')
    ET.register_namespace('di', 'http://www.omg.org/spec/DD/20100524/DI')

    tree = ET.parse(str(path))
    root = tree.getroot()

    bpmn_ns = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
    di_ns = 'http://www.omg.org/spec/BPMN/20100524/DI'
    dc_ns = 'http://www.omg.org/spec/DD/20100524/DC'

    process = root.find(f'{{{bpmn_ns}}}process')
    diagram = root.find(f'{{{di_ns}}}BPMNDiagram')
    if process is None or diagram is None:
      return

    plane = diagram.find(f'{{{di_ns}}}BPMNPlane')
    if plane is None:
      return

    # Build a map of element id -> DI Bounds (x, y, width, height)
    shapes = {}
    for shape in plane.findall(f'{{{di_ns}}}BPMNShape'):
      elem_id = shape.get('bpmnElement')
      bounds = shape.find(f'{{{dc_ns}}}Bounds')
      if elem_id and bounds is not None:
        shapes[elem_id] = {
          'shape': shape,
          'bounds': bounds,
          'x': float(bounds.get('x', 0)),
          'y': float(bounds.get('y', 0)),
          'width': float(bounds.get('width', 0)),
          'height': float(bounds.get('height', 0)),
        }

    # Build sequence flow map: source -> [targets], target -> [sources]
    outgoing = {}  # gateway_id -> list of target task ids
    incoming = {}  # gateway_id -> list of source task ids

    gateway_ids = set()
    for elem in process:
      tag = elem.tag.split('}')[-1]
      if tag in ('exclusiveGateway', 'parallelGateway', 'inclusiveGateway',
                 'eventBasedGateway', 'complexGateway'):
        gateway_ids.add(elem.get('id'))

    for flow in process.findall(f'{{{bpmn_ns}}}sequenceFlow'):
      src = flow.get('sourceRef')
      tgt = flow.get('targetRef')
      if src in gateway_ids:
        outgoing.setdefault(src, []).append(tgt)
      if tgt in gateway_ids:
        incoming.setdefault(tgt, []).append(src)

    # Reposition each gateway Y to be the median Y of its connected elements
    for gw_id in gateway_ids:
      if gw_id not in shapes:
        continue

      connected_ids = outgoing.get(gw_id, []) + incoming.get(gw_id, [])
      connected_ys = []
      for cid in connected_ids:
        if cid in shapes:
          s = shapes[cid]
          # Use the vertical center of the connected element
          connected_ys.append(s['y'] + s['height'] / 2)

      if not connected_ys:
        continue

      # Place gateway at the median Y of connected activities, minus half its height
      median_y = sorted(connected_ys)[len(connected_ys) // 2]
      gw_shape = shapes[gw_id]
      new_y = median_y - gw_shape['height'] / 2

      gw_shape['bounds'].set('y', str(new_y))

    tree.write(str(path), xml_declaration=True, encoding='utf-8')

  def _reroute_long_flows(self, path: Path) -> None:
    DETOUR_MARGIN = 20  # px clearance above/below the task row

    ET.register_namespace('', 'http://www.omg.org/spec/BPMN/20100524/MODEL')
    ET.register_namespace('bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI')
    ET.register_namespace('dc', 'http://www.omg.org/spec/DD/20100524/DC')
    ET.register_namespace('di', 'http://www.omg.org/spec/DD/20100524/DI')

    tree = ET.parse(str(path))
    root = tree.getroot()
    di_ns = 'http://www.omg.org/spec/BPMN/20100524/DI'
    dc_ns = 'http://www.omg.org/spec/DD/20100524/DC'

    plane = root.find(f'.//{{{di_ns}}}BPMNPlane')
    if plane is None:
      return

    # Collect all task bounding boxes
    task_boxes = []
    for shape in plane.findall(f'{{{di_ns}}}BPMNShape'):
      bounds = shape.find(f'{{{dc_ns}}}Bounds')
      if bounds is None:
        continue
      x = float(bounds.get('x', 0))
      y = float(bounds.get('y', 0))
      w = float(bounds.get('width', 0))
      h = float(bounds.get('height', 0))
      task_boxes.append((x, y, x + w, y + h))

    def _boxes_in_x_range(x_min, x_max, y_center, tolerance=5):
      """Return all task boxes whose x-range overlaps [x_min, x_max]
      and whose y-band contains y_center."""
      hits = []
      for bx0, by0, bx1, by1 in task_boxes:
        if bx1 < x_min or bx0 > x_max:
          continue
        if by0 - tolerance <= y_center <= by1 + tolerance:
          hits.append((bx0, by0, bx1, by1))
      return hits

    for edge in plane.findall(f'{{{di_ns}}}BPMNEdge'):
      waypoints = edge.findall(f'{{{di_ns}}}waypoint')
      if len(waypoints) < 2:
        continue

      new_waypoints = [waypoints[0]]
      for i in range(1, len(waypoints)):
        prev = new_waypoints[-1]
        curr = waypoints[i]
        x0 = float(prev.get('x'))
        y0 = float(prev.get('y'))
        x1 = float(curr.get('x'))
        y1 = float(curr.get('y'))

        # Only check nearly-horizontal segments
        if abs(y1 - y0) < 5 and abs(x1 - x0) > 100:
          hits = _boxes_in_x_range(
            min(x0, x1) + 10, max(x0, x1) - 10, y0
          )
          if hits:
            # Route above all intersected boxes
            top_y = min(by0 for _, by0, _, _ in hits)
            detour_y = top_y - DETOUR_MARGIN
            # Insert intermediate waypoints for the detour
            wp_up1 = ET.SubElement(edge, f'{{{di_ns}}}waypoint')
            wp_up1.set('x', str(x0))
            wp_up1.set('y', str(detour_y))
            wp_across = ET.SubElement(edge, f'{{{di_ns}}}waypoint')
            wp_across.set('x', str(x1))
            wp_across.set('y', str(detour_y))
            new_waypoints.append(wp_up1)
            new_waypoints.append(wp_across)
        new_waypoints.append(curr)

      # Replace waypoints in edge (remove old, the SubElement calls above added new ones)

    tree.write(str(path), xml_declaration=True, encoding='utf-8')

  def _layout_by_process_flow(self, path: Path) -> None:

    import xml.etree.ElementTree as ET

    ET.register_namespace('', 'http://www.omg.org/spec/BPMN/20100524/MODEL')
    ET.register_namespace('bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI')
    ET.register_namespace('dc', 'http://www.omg.org/spec/DD/20100524/DC')
    ET.register_namespace('di', 'http://www.omg.org/spec/DD/20100524/DI')

    tree = ET.parse(str(path))
    root = tree.getroot()

    bpmn_ns = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
    di_ns = 'http://www.omg.org/spec/BPMN/20100524/DI'
    dc_ns = 'http://www.omg.org/spec/DD/20100524/DC'

    process = root.find(f'{{{bpmn_ns}}}process')
    diagram = root.find(f'{{{di_ns}}}BPMNDiagram')

    if process is None or diagram is None:
      return

    plane = diagram.find(f'{{{di_ns}}}BPMNPlane')

    if plane is None:
      return

    START_X = 100
    HORIZONTAL_SPACING = 240

    shapes = {}

    for shape in plane.findall(f'{{{di_ns}}}BPMNShape'):
      elem_id = shape.get('bpmnElement')

      bounds = shape.find(f'{{{dc_ns}}}Bounds')

      if elem_id and bounds is not None:
        shapes[elem_id] = {
          'shape': shape,
          'bounds': bounds,
          'x': float(bounds.get('x', 0)),
          'y': float(bounds.get('y', 0)),
          'width': float(bounds.get('width', 0)),
          'height': float(bounds.get('height', 0)),
        }

    node_tags = {}
    start_nodes = []
    end_nodes = []

    valid_node_types = {
      'task',
      'userTask',
      'serviceTask',
      'scriptTask',
      'manualTask',
      'businessRuleTask',
      'sendTask',
      'receiveTask',
      'exclusiveGateway',
      'parallelGateway',
      'inclusiveGateway',
      'eventBasedGateway',
      'complexGateway',
      'startEvent',
      'endEvent',
      'intermediateCatchEvent',
      'intermediateThrowEvent'
    }

    for elem in process:
      tag = elem.tag.split('}')[-1]

      if tag in valid_node_types:
        elem_id = elem.get('id')

        if not elem_id:
          continue

        node_tags[elem_id] = tag

        if tag == 'startEvent':
          start_nodes.append(elem_id)

        elif tag == 'endEvent':
          end_nodes.append(elem_id)

    # ------------------------------------------------------------------
    # BUILD GRAPH
    # ------------------------------------------------------------------

    outgoing = {}
    incoming = {}

    for flow in process.findall(f'{{{bpmn_ns}}}sequenceFlow'):

      src = flow.get('sourceRef')
      tgt = flow.get('targetRef')

      if not src or not tgt:
        continue

      outgoing.setdefault(src, []).append(tgt)
      incoming.setdefault(tgt, []).append(src)

    # ------------------------------------------------------------------
    # COMPUTE NODE DEPTHS
    # ------------------------------------------------------------------

    depth = {}

    queue = deque()

    # Start events always depth 0
    for start_id in start_nodes:
      depth[start_id] = 0
      queue.append(start_id)

    visited = set()

    while queue:

      current = queue.popleft()

      visited.add(current)

      current_depth = depth[current]

      for nxt in outgoing.get(current, []):

        proposed_depth = current_depth + 1

        # Keep deepest path for converging gateways
        if proposed_depth > depth.get(nxt, -1):
          depth[nxt] = proposed_depth

        if nxt not in visited:
          queue.append(nxt)

    # ------------------------------------------------------------------
    # HANDLE ORPHAN NODES
    # ------------------------------------------------------------------

    # Sometimes BPMN exporters create disconnected nodes.
    # Keep them from collapsing to x=0.
    for node_id in node_tags:
      if node_id not in depth:
        depth[node_id] = 1

    # ------------------------------------------------------------------
    # FORCE END EVENTS TO FINAL COLUMN
    # ------------------------------------------------------------------

    max_depth = max(depth.values()) if depth else 0

    for end_id in end_nodes:
      depth[end_id] = max_depth + 1

    # ------------------------------------------------------------------
    # APPLY X COORDINATES
    # ------------------------------------------------------------------

    for node_id, node_depth in depth.items():

      if node_id not in shapes:
        continue

      shape_data = shapes[node_id]
      bounds = shape_data['bounds']

      tag = node_tags.get(node_id, '')

      # --------------------------------------------------------------
      # Determine X position
      # --------------------------------------------------------------

      if tag == 'startEvent':
        new_x = START_X

      elif tag == 'endEvent':
        new_x = START_X + ((max_depth + 1) * HORIZONTAL_SPACING)

      else:
        new_x = START_X + (node_depth * HORIZONTAL_SPACING)

      # --------------------------------------------------------------
      # Preserve existing Y
      # --------------------------------------------------------------

      bounds.set('x', str(new_x))

    # ------------------------------------------------------------------
    # OPTIONAL:
    # SHIFT CONVERGING GATEWAYS SLIGHTLY RIGHT
    # FOR BETTER VISUAL MERGING
    # ------------------------------------------------------------------

    gateway_types = {
      'exclusiveGateway',
      'parallelGateway',
      'inclusiveGateway',
      'eventBasedGateway',
      'complexGateway'
    }

    for node_id, tag in node_tags.items():

      if tag not in gateway_types:
        continue

      incoming_nodes = incoming.get(node_id, [])
      outgoing_nodes = outgoing.get(node_id, [])

      # Converging gateway:
      # multiple incoming, single outgoing
      if len(incoming_nodes) > 1:

        shape_data = shapes.get(node_id)

        if not shape_data:
          continue

        incoming_depths = [
          depth.get(n, 0)
          for n in incoming_nodes
        ]

        if incoming_depths:
          merge_depth = max(incoming_depths) + 1

          new_x = START_X + (merge_depth * HORIZONTAL_SPACING)

          shape_data['bounds'].set('x', str(new_x))

    # ------------------------------------------------------------------
    # SAVE
    # ------------------------------------------------------------------

    tree.write(str(path), xml_declaration=True, encoding='utf-8')

  @property
  def file_type(self):
    return self._file_type

  @property
  def file_contents(self):
    return self._file_contents

  @file_contents.setter
  def file_contents(self, bp_notation: BPMN):
    self._file_contents = bp_notation

class DiagramFactory:
  @staticmethod
  def create_diagram(diagram_type: str, file_type: str,  contents: BPMN):
    if diagram_type.lower() == 'swimlane':
      return SwimlaneDiagram(file_type, contents)
    else:
      raise ValueError(f"Unknown diagram type: {diagram_type}")

