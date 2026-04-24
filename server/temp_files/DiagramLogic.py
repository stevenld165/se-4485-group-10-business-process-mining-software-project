from abc import ABC, abstractmethod
from pathlib import Path

from pm4py import BPMN

from Writers import WriterFactory
from Readers import ReaderFactory


class BPMNGraph(ABC):

  @abstractmethod
  def read_graph(self) -> str:
    pass

  @abstractmethod
  def write_graph(self, file_location: str, file_contents: str, object_id: str, file_type: str) -> None:
    pass


class SwimlaneDiagram(BPMNGraph):
  def __init__(self, file_type: str = None, contents: BPMN = None, location: Path = None):
    self.file_contents = contents
    self.file_location = location
    self.file_type = file_type
    self.file_writer = WriterFactory.create_writer('Diagram')
    self.file_reader = ReaderFactory.create_reader('Diagram')

  def read_graph(self) -> bytes:
    return self.file_reader.read_file(self.file_location)

  def write_graph(self, file_location: Path, file_contents: str, object_id: str, file_type: str = 'bpmn') -> None:
    self.file_writer.write_to_file(file_location, file_contents, object_id, file_type)
    self.file_contents = file_contents
    self.file_location = file_location

  @property
  def file_format(self):
    return self.file_format

  @property
  def file_contents(self):
    return self.file_contents

  @file_contents.setter
  def file_contents(self, bp_notation: BPMN):
    self.file_contents = bp_notation

class DiagramFactory:
  @staticmethod
  def create_diagram(diagram_type: str, file_type: str,  contents: BPMN):
    if diagram_type.lower() == 'swimlane':
      SwimlaneDiagram(file_type, contents)
