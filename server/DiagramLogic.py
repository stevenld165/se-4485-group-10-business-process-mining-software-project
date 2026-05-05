from abc import ABC, abstractmethod
from pathlib import Path
import json
import xml.etree.ElementTree as ET
import re

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

