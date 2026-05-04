from abc import ABC, abstractmethod
from pathlib import Path
import json
import xml.etree.ElementTree as ET

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
    self._add_role_map(role_map, new_location)
    self.file_contents = file_contents
    self.file_location = new_location

  def _add_role_map(self, role_map: dict, path: Path) -> None:
    ET.register_namespace('bpmn', 'http://www.omg.org/spec/BPMN/20100524/MODEL')
    ET.register_namespace('bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI')
    ET.register_namespace('dc', 'http://www.omg.org/spec/DD/20100524/DC')
    ET.register_namespace('di', 'http://www.omg.org/spec/DD/20100524/DI')

    role_map_json = json.dumps({
      role: list(activities) if isinstance(activities, set) else activities
      for role, activities in role_map.items()
    })
    tree = ET.parse(str(path))
    root = tree.getroot()
    bpmn_ns = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
    process_el = root.find(f'{{{bpmn_ns}}}process')
    if process_el is not None:
      process_el.set('data-actor-map', role_map_json)
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

