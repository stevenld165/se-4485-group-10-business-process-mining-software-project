from abc import ABC, abstractmethod
import xml.etree.ElementTree as ET
from pathlib import Path
import json
import re

from pm4py import BPMN

from Writers import WriterFactory
from Readers import ReaderFactory
from FormatConversion import ConverterFactory
from BPMNDiagramContext import SwimlaneDiagramContext
from BPMNRoleMapper import BPMNRoleMapper
from BPMNLayoutEngine import SwimlaneLayoutEngine


class BPMNGraph(ABC):
  """Abstract base class for BPMN diagram types."""

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

  def write_graph(self, file_location: Path, file_contents: BPMN, object_id: str, file_type: str,
                  role_map: dict) -> None:
    new_location = self.file_writer.write_to_file(file_location, file_contents, object_id, file_type)
    try:
      context = SwimlaneDiagramContext(new_location)
    except Exception as e:
      raise RuntimeError(f"Failed to load BPMN context from {new_location}: {e}")
    enhanced_role_map = self._extract_actor_assignments(file_contents)
    if role_map:
      for actor, activities in role_map.items():
        if actor not in enhanced_role_map:
          enhanced_role_map[actor] = activities
    if enhanced_role_map:
      self._apply_role_mapping(context, enhanced_role_map)
    layout_engine = SwimlaneLayoutEngine(context)
    layout_engine.layout_by_process_flow()
    layout_engine.reposition_gateways()
    layout_engine.reroute_long_flows()
    context.save()
    self._store_role_map_metadata(new_location, enhanced_role_map)
    self.file_contents = file_contents
    self.file_location = new_location

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
      print(f"Warning: Failed to extract actor assignments: {e}")
    return actor_tasks

  def _apply_role_mapping(self, context: SwimlaneDiagramContext, role_map: dict) -> None:
    role_mapper = BPMNRoleMapper(context)
    role_mapper.apply(role_map, self._file_contents)

  def _store_role_map_metadata(self, path: Path, role_map: dict) -> None:
    if not role_map:
      return
    try:
      tree = ET.parse(str(path))
      root = tree.getroot()
      bpmn_ns = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
      process_el = root.find(f'{{{bpmn_ns}}}process')
      if process_el is not None:
        role_map_json = json.dumps({
          role: list(activities) if isinstance(activities, set) else activities
          for role, activities in role_map.items()
        })
        process_el.set('data-role-map', role_map_json)
        tree.write(str(path), xml_declaration=True, encoding='utf-8')
    except Exception as e:
      print(f"Warning: Failed to store role map metadata: {e}")

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
  def create_diagram(diagram_type: str, file_type: str, contents: BPMN):
    if diagram_type.lower() == 'swimlane':
      return SwimlaneDiagram(file_type, contents)
    else:
      raise ValueError(f"Unknown diagram type: {diagram_type}")
