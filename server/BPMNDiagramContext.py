from dataclasses import dataclass
import xml.etree.ElementTree as ET
from pathlib import Path

class SwimlaneDiagramContext:

  BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
  DI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'
  DC_NS = 'http://www.omg.org/spec/DD/20100524/DC'

  GATEWAY_TYPES = {
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'eventBasedGateway',
    'complexGateway'
  }

  def __init__(self, path: Path):
    self.path = path
    self._register_namespaces()
    self.tree = ET.parse(str(path))
    self.root = self.tree.getroot()
    self.process = self._load_process()
    self.plane = self._load_plane()
    self.shapes = self._load_shapes()
    self.node_types = self._load_node_types()
    self.outgoing = {}
    self.incoming = {}
    self._load_graph()

  def save(self) -> None:
    self.tree.write(
      str(self.path),
      xml_declaration=True,
      encoding='utf-8'
    )

  def is_gateway(self, node_id: str) -> bool:
    return self.node_types.get(node_id) in self.GATEWAY_TYPES

  def _register_namespaces(self) -> None:
    ET.register_namespace('', self.BPMN_NS)
    ET.register_namespace('bpmndi', self.DI_NS)
    ET.register_namespace('dc', self.DC_NS)
    ET.register_namespace(
      'di',
      'http://www.omg.org/spec/DD/20100524/DI'
    )

  def _load_process(self):
    return self.root.find(
      f'{{{self.BPMN_NS}}}process'
    )

  def _load_plane(self):
    diagram = self.root.find(
      f'{{{self.DI_NS}}}BPMNDiagram'
    )
    if diagram is None:
      return None
    else:
      return diagram.find(
        f'{{{self.DI_NS}}}BPMNPlane'
      )

  def _load_shapes(self) -> dict:
    shapes = {}
    if self.plane is None:
      return shapes

    for shape in self.plane.findall(
      f'{{{self.DI_NS}}}BPMNShape'
    ):
      shape_data = self._create_shape(shape)
      if shape_data:
        shapes[shape_data.element_id] = shape_data

    return shapes

  def _create_shape(self, shape):
    element_id = shape.get('bpmnElement')
    bounds = shape.find(
      f'{{{self.DC_NS}}}Bounds'
    )
    if not element_id or bounds is None:
      return None
    else:
      return ShapeBounds(
        element_id=element_id,
        shape=shape,
        bounds=bounds,
        x=float(bounds.get('x', 0)),
        y=float(bounds.get('y', 0)),
        width=float(bounds.get('width', 0)),
        height=float(bounds.get('height', 0)),
      )

  def _load_node_types(self) -> dict:
    node_types = {}
    if self.process is None:
      return node_types
    for elem in self.process:
      elem_id = elem.get('id')
      if not elem_id:
        continue
      tag = elem.tag.split('}')[-1]
      node_types[elem_id] = tag
    return node_types

  def _load_graph(self) -> None:
    if self.process is None:
      return
    for flow in self.process.findall(
      f'{{{self.BPMN_NS}}}sequenceFlow'
    ):
      self._register_flow(flow)

  def _register_flow(self, flow) -> None:
    src = flow.get('sourceRef')
    tgt = flow.get('targetRef')
    if not src or not tgt:
      return
    self.outgoing.setdefault(src, []).append(tgt)
    self.incoming.setdefault(tgt, []).append(src)


@dataclass
class ShapeBounds:
    element_id: str
    shape: ET.Element
    bounds: ET.Element

    x: float
    y: float
    width: float
    height: float

    @property
    def center_x(self) -> float:
        return self.x + (self.width / 2)

    @property
    def center_y(self) -> float:
        return self.y + (self.height / 2)

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def set_x(self, value: float):
        self.x = value
        self.bounds.set('x', str(value))

    def set_y(self, value: float):
        self.y = value
        self.bounds.set('y', str(value))