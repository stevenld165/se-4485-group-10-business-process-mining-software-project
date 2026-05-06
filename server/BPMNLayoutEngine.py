from BPMNDiagramContext import SwimlaneDiagramContext, ShapeBounds
import xml.etree.ElementTree as ET
from collections import deque

class SwimlaneLayoutEngine:
  START_X = 100
  HORIZONTAL_SPACING = 240

  def __init__(self, context: SwimlaneDiagramContext):
    self.ctx = context


  def layout_by_process_flow(self) -> None:
    depth_map = self._calculate_depths()
    self._position_shapes(depth_map)

  def reposition_gateways(self) -> None:
    gateway_ids = self._gateway_ids()
    for gateway_id in gateway_ids:
      self._reposition_gateway(gateway_id)

  def reroute_long_flows(self) -> None:
    DETOUR_MARGIN = 20
    task_boxes = self._task_boxes()
    edges = self.ctx.plane.findall(f'{{{self.ctx.DI_NS}}}BPMNEdge')
    for edge in edges:
      self._reroute_edge(edge, task_boxes, DETOUR_MARGIN)

  def _calculate_depths(self) -> dict:
    depth = {}
    queue = deque()
    self._enqueue_start_events(depth, queue)
    self._walk_graph(depth, queue)
    self._assign_orphan_depths(depth)
    self._push_end_events(depth)
    return depth

  def _enqueue_start_events(self, depth: dict, queue: deque) -> None:
    for node_id, tag in self.ctx.node_types.items():
      if tag != 'startEvent':
        continue
      depth[node_id] = 0
      queue.append(node_id)

  def _walk_graph(self, depth: dict, queue: deque) -> None:
    visited = set()
    while queue:
      current = queue.popleft()
      visited.add(current)
      self._visit_neighbors(current, depth, queue, visited)

  def _visit_neighbors(self, current: str, depth: dict,
                       queue: deque, visited: set) -> None:
    current_depth = depth[current]
    neighbors = self.ctx.outgoing.get(current, [])

    for neighbor in neighbors:
      self._update_depth(current_depth, neighbor, depth)
      if neighbor not in visited:
        queue.append(neighbor)

  def _update_depth(self, current_depth: int, neighbor: str, depth: dict) -> None:
    proposed_depth = current_depth + 1
    existing_depth = depth.get(neighbor, -1)
    if proposed_depth > existing_depth:
      depth[neighbor] = proposed_depth

  def _assign_orphan_depths(self, depth: dict) -> None:
    for node_id in self.ctx.node_types:
      if node_id not in depth:
        depth[node_id] = 1

  def _push_end_events(self, depth: dict) -> None:
    max_depth = max(depth.values())
    for node_id, tag in self.ctx.node_types.items():
      if tag != 'endEvent':
        continue
      depth[node_id] = max_depth + 1

  def _position_shapes(self, depth_map: dict) -> None:
    max_depth = max(depth_map.values())
    for node_id, depth in depth_map.items():
      self._position_shape(node_id, depth, max_depth)

  def _position_shape(self, node_id: str, depth: int, max_depth: int) -> None:
    shape = self.ctx.shapes.get(node_id)
    if not shape:
      return
    x = self._calculate_x_position(node_id, depth, max_depth)
    shape.set_x(x)

  def _calculate_x_position(self, node_id: str, depth: int, max_depth: int) -> float:
    tag = self.ctx.node_types.get(node_id)
    if tag == 'startEvent':
      return self.START_X
    elif tag == 'endEvent':
      return self._end_event_x(max_depth)
    else:
      return self._depth_x(depth)

  def _depth_x(self, depth: int) -> float:
    return self.START_X + (depth * self.HORIZONTAL_SPACING)

  def _end_event_x(self, max_depth: int) -> float:
    return self.START_X + ((max_depth + 1) * self.HORIZONTAL_SPACING)

  def _gateway_ids(self) -> list:
    return [
      node_id
      for node_id in self.ctx.node_types
      if self.ctx.is_gateway(node_id)
    ]

  def _reposition_gateway(self, gateway_id: str) -> None:
    gateway = self.ctx.shapes.get(gateway_id)
    if not gateway:
      return
    connected_shapes = self._connected_shapes(gateway_id)
    if not connected_shapes:
      return
    new_y = self._median_y(connected_shapes, gateway)
    gateway.set_y(new_y)

  def _connected_shapes(self, gateway_id: str) -> list:
    connected_ids = (self.ctx.outgoing.get(gateway_id, [])
                     + self.ctx.incoming.get(gateway_id, []))
    return [
      self.ctx.shapes[node_id]
      for node_id in connected_ids
      if node_id in self.ctx.shapes
    ]

  def _median_y(self, shapes: list, gateway: ShapeBounds) -> float:
    centers = sorted(
      shape.center_y
      for shape in shapes
    )
    median_center = centers[len(centers) // 2]
    return median_center - (gateway.height / 2)

  def _task_boxes(self) -> list:
    task_boxes = []
    for shape in self.ctx.shapes.values():
      task_boxes.append(self._shape_box(shape))
    return task_boxes

  def _shape_box(self, shape: ShapeBounds) -> tuple:
    return (
      shape.x,
      shape.y,
      shape.x + shape.width,
      shape.y + shape.height
    )

  def _reroute_edge(self, edge, task_boxes: list, detour_margin: int) -> None:
    waypoints = edge.findall(f'{{{self.ctx.DI_NS}}}waypoint')
    if len(waypoints) < 2:
      return
    new_points = list()
    self._append_waypoint_copy(new_points, waypoints[0])
    for index in range(1, len(waypoints)):
      previous = new_points[-1]
      current = waypoints[index]
      self._process_segment(previous, current, new_points, task_boxes, detour_margin)

    self._replace_waypoints(edge, new_points)

  def _process_segment(self, previous, current, new_points: list, task_boxes: list, detour_margin: int) -> None:
    x0 = float(previous.get('x'))
    y0 = float(previous.get('y'))
    x1 = float(current.get('x'))
    y1 = float(current.get('y'))
    if not self._is_long_horizontal_segment(x0, y0, x1, y1):
      self._append_waypoint_copy(new_points, current)
      return

    hits = self._intersecting_boxes(x0, x1, y0, task_boxes)
    if not hits:
      self._append_waypoint_copy(new_points, current)
      return

    detour_y = self._detour_y(hits, detour_margin)
    self._append_waypoint(new_points, x0, detour_y)
    self._append_waypoint(new_points, x1, detour_y)
    self._append_waypoint_copy(new_points, current)

  def _is_long_horizontal_segment(self, x0: float, y0: float, x1: float, y1: float) -> bool:
    horizontal = abs(y1 - y0) < 5
    long_enough = abs(x1 - x0) > 100
    return horizontal and long_enough

  def _intersecting_boxes(self, x0: float, x1: float, y_center: float,
                          task_boxes: list, tolerance: int = 5) -> list:
    x_min = min(x0, x1) + 10
    x_max = max(x0, x1) - 10

    hits = list()
    for bx0, by0, bx1, by1 in task_boxes:
      if bx1 < x_min:
        continue
      if bx0 > x_max:
        continue
      if not (by0 - tolerance <= y_center <= by1 + tolerance):
        continue
      hits.append((bx0, by0, bx1, by1))
    return hits

  def _detour_y(self, hits: list, detour_margin: int) -> float:
    top_y = min(by0 for _, by0, _, _ in hits)
    return top_y - detour_margin

  def _append_waypoint(self, waypoints: list, x: float, y: float) -> None:
    waypoint = ET.Element(f'{{{self.ctx.DI_NS}}}waypoint')
    waypoint.set('x', str(x))
    waypoint.set('y', str(y))
    waypoints.append(waypoint)

  def _append_waypoint_copy(self, waypoints: list, source) -> None:
    x = float(source.get('x'))
    y = float(source.get('y'))
    self._append_waypoint(waypoints, x, y)

  def _replace_waypoints(self, edge, new_points: list) -> None:
    old_points = edge.findall(f'{{{self.ctx.DI_NS}}}waypoint')
    for point in old_points:
      edge.remove(point)
    for point in new_points:
      edge.append(point)
