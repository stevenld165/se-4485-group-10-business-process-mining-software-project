import xml.etree.ElementTree as ET
from BPMNDiagramContext import SwimlaneDiagramContext, ShapeBounds


class BPMNRoleMapper:
  LANE_HEIGHT = 175
  LANE_X = 80
  LANE_WIDTH_PADDING = 400

  def __init__(self, context: SwimlaneDiagramContext):
    if not isinstance(context, SwimlaneDiagramContext):
      raise ValueError("Context must be instance of SwimlaneDiagramContext")
    if context.process is None:
      raise ValueError("Context process cannot be None")
    if context.plane is None:
      raise ValueError("Context plane cannot be None")
    self.ctx = context

  def apply(self, role_map: dict, file_contents) -> None:
    collaboration = self._collaboration()
    if collaboration is None:
      return

    lane_set = self._lane_set()
    if lane_set is None:
      return

    self._create_lanes(lane_set, role_map)
    self._assign_flow_nodes(lane_set, role_map)
    self._resize_participant(collaboration, role_map)
    self._position_lanes(role_map)
    self._position_nodes(role_map)

  def _collaboration(self):
    return self.ctx.root.find(f'{{{self.ctx.BPMN_NS}}}collaboration')

  def _lane_set(self):
    process = self.ctx.process
    if process is None:
      return None
    lane_set = process.find(f'{{{self.ctx.BPMN_NS}}}laneSet')
    if lane_set is not None:
      return lane_set

    return ET.SubElement(process, f'{{{self.ctx.BPMN_NS}}}laneSet')

  def _create_lanes(self, lane_set, role_map: dict) -> None:
    for role in role_map:
      self._create_lane(lane_set, role)

  def _create_lane(self, lane_set, role: str) -> None:
    lane = ET.SubElement(lane_set, f'{{{self.ctx.BPMN_NS}}}lane')
    lane.set('id', f'lane_{role}')
    lane.set('name', role)

  def _assign_flow_nodes(self, lane_set, role_map: dict) -> None:
    for lane in lane_set.findall(f'{{{self.ctx.BPMN_NS}}}lane'):
      role = lane.get('name')
      node_ids = role_map.get(role, [])
      self._assign_nodes_to_lane(lane, node_ids)

  def _assign_nodes_to_lane(self, lane, node_ids: list) -> None:
    for node_id in node_ids:
      flow_ref = ET.SubElement(lane, f'{{{self.ctx.BPMN_NS}}}flowNodeRef')
      flow_ref.text = node_id

  def _resize_participant(self, collaboration, role_map: dict) -> None:
    participant = collaboration.find(f'{{{self.ctx.BPMN_NS}}}participant')
    if participant is None:
      return

    participant_id = participant.get('id')
    shape = self.ctx.shapes.get(participant_id)
    if shape is None:
      return

    height = self._participant_height(role_map)
    shape.bounds.set('height', str(height))

  def _participant_height(self, role_map: dict) -> int:
    lane_count = len(role_map)
    return lane_count * self.LANE_HEIGHT

  def _position_lanes(self, role_map: dict) -> None:
    for index, role in enumerate(role_map):
      self._position_lane(role, index)

  def _position_lane(self, role: str, index: int) -> None:
    lane_shape = self._create_lane_shape(role)
    y = self._lane_y(index)
    width = self._lane_width()
    self._set_lane_bounds(lane_shape, y, width)

  def _create_lane_shape(self, role: str) -> ET.Element:
    lane_shape = ET.SubElement(self.ctx.plane, f'{{{self.ctx.DI_NS}}}BPMNShape')
    lane_shape.set('bpmnElement', f'lane_{role}')
    return lane_shape

  def _lane_y(self, index: int) -> int:
    return index * self.LANE_HEIGHT

  def _lane_width(self) -> float:
    if not self.ctx.shapes:
      return 1200
    rightmost = max((shape.x + shape.width for shape in self.ctx.shapes.values()), default=0)
    return rightmost + self.LANE_WIDTH_PADDING

  def _set_lane_bounds(self, lane_shape: ET.Element, y: int, width: float) -> None:
    bounds = ET.SubElement(lane_shape, f'{{{self.ctx.DC_NS}}}Bounds')
    bounds.set('x', str(self.LANE_X))
    bounds.set('y', str(y))
    bounds.set('width', str(width))
    bounds.set('height', str(self.LANE_HEIGHT))

    lane_id = lane_shape.get('bpmnElement')
    if lane_id:
      self.ctx.shapes[lane_id] = ShapeBounds(
        element_id=lane_id,
        shape=lane_shape,
        bounds=bounds,
        x=self.LANE_X,
        y=y,
        width=width,
        height=self.LANE_HEIGHT
      )

  def _position_nodes(self, role_map: dict) -> None:
    for index, role in enumerate(role_map):
      node_ids = role_map[role]
      lane_center_y = self._lane_center_y(index)
      self._center_nodes(node_ids, lane_center_y)

  def _lane_center_y(self, index: int) -> float:
    lane_top = index * self.LANE_HEIGHT
    return lane_top + (self.LANE_HEIGHT / 2)

  def _center_nodes(self, node_ids: list, lane_center_y: float) -> None:
    for node_id in node_ids:
      shape = self.ctx.shapes.get(node_id)
      if shape is None:
        continue

      # Center node vertically in lane
      y = lane_center_y - (shape.height / 2)
      shape.set_y(y)