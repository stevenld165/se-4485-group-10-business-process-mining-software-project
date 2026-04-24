from abc import ABC, abstractmethod
from pathlib import Path

from pm4py import BPMN

from Writers import WriterFactory, FileWriter

class BPMNGraph(ABC):

  @abstractmethod
  def read_graph(self) -> str:
    pass

  @abstractmethod
  def write_graph(self, file_location: str, file_contents: str, file_type: str) -> None:
    pass


class SwimlaneDiagram(BPMNGraph):
  def __init__(self, name: str = None, contents: BPMN = None, location: Path = None):
    self.file_name = name
    self.file_contents = contents
    self.file_location = location
    pass

  def read_graph(self) -> str:
    # open the file location of the event log
    # output the formatted contents of log
    return 'contents of run'

  def write_graph(self, file_location: str, file_contents: str, file_type: str) -> None:
    # create an empty file in the location
    # depending on type, create a new file writer
    # set name equivalent to log name
    # Write log to memory
    pass

class DiagramFactory:
  @staticmethod
  def create_diagram(diagram_type: str, contents: ):
    if diagram_type.lower() == 'swimlane':
