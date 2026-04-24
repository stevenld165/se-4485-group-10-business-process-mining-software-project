from abc import ABC, abstractmethod

class FormatValidator(ABC):
  @abstractmethod
  def validate_file_type(self, file_type: str) -> bool:
    pass


class EventLogFormatValidator(FormatValidator):
  def __init__(self, allowed_file_types: list):
    self._accepted_types: list = allowed_file_types
    return

  def validate_file_type(self, file_type: str) -> bool:
    if file_type in self._accepted_types:
      return True
    else:
      return False


class GraphBPMNFormatValidator(FormatValidator):
  def __init__(self, allowed_file_formats: list):
    self._accepted_formats: list = allowed_file_formats

  def validate_file_type(self, file_type: str) -> bool:
    if file_type in self._accepted_formats:
      return True
    else:
      return False


class StructureValidator(ABC):
  @abstractmethod
  def validate_structure(self, file_structure: list) -> bool:
    pass


class OCELStructureValidator(StructureValidator):
  def __init__(self, allowed_file_structure: list):
    self._allowed_file_structure: list = allowed_file_structure

  def validate_structure(self, file_structure: list) -> bool:
    if self._allowed_file_structure in file_structure:
      return True
    else:
      return False


class CCELStructureValidator(StructureValidator):
  def __init__(self, allowed_file_structure: list):
    self._allowed_file_structure: list = allowed_file_structure

  def validate_structure(self, file_structure: list) -> bool:
    if self._allowed_file_structure in file_structure:
      return True
    else:
      return False


class Validator:
  @staticmethod
  def create_format_validator(object_type: str, allowed_file_formats: list) -> FormatValidator:
    if object_type == 'EventLog':
      return EventLogFormatValidator(allowed_file_formats)
    elif object_type == 'Graph':
      return GraphBPMNFormatValidator(allowed_file_formats)

  @staticmethod
  def create_structure_validator(object_type: str, allowed_file_structure: list) -> StructureValidator:
    if object_type == 'OCEL':
      return OCELStructureValidator(allowed_file_structure)
    elif object_type == 'CCEL':
      return CCELStructureValidator(allowed_file_structure)