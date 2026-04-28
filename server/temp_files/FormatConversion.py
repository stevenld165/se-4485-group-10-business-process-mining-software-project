from abc import ABC, abstractmethod
import xml.etree.ElementTree as ET
import pandas as pd
import json
import io

class FormatGeneralizer(ABC):
  @abstractmethod
  def convert_from(self, raw: bytes) -> pd.DataFrame:
    pass

class MetadataFormatter(ABC):
  @abstractmethod
  def convert_to(self, raw: bytes) -> dict:
    pass

class TransportFormatter(ABC):
  @abstractmethod
  def convert(self, raw):
    pass

class FromJSONToDFConverter(FormatGeneralizer):
  def convert_from(self, raw: bytes) -> pd.DataFrame:
    return pd.read_json(io.BytesIO(raw))

class FromXMLToDFConverter(FormatGeneralizer):
  def convert_from(self, raw: bytes) -> pd.DataFrame:
    return pd.read_xml(io.BytesIO(raw))

class FromCSVToDFConverter(FormatGeneralizer):
  def convert_from(self, raw: bytes) -> pd.DataFrame:
    return pd.read_csv(io.StringIO(raw.decode('utf-8')))

class FromParaquetToDFConverter(FormatGeneralizer):
  def convert_from(self, raw: bytes) -> pd.DataFrame:
    return pd.read_parquet(io.BytesIO(raw))

class TextToJsonConverter(MetadataFormatter):
  def convert_to(self, raw: bytes) -> dict:
    return json.loads(raw)

class XMLToElementConverter:
  def convert_to(self, raw: bytes) -> ET.Element:
    return ET.parse(io.BytesIO(raw)).getroot()

class BytesToStringConverter(TransportFormatter):
  def convert(self, raw: bytes) -> str:
    return raw.decode("utf-8")


class ConverterFactory:
  @staticmethod
  def create_df_converter(file_type: str) -> FormatGeneralizer:
    if 'json' in file_type.lower():
      return FromJSONToDFConverter()
    elif 'xml' in file_type.lower():
      return FromXMLToDFConverter()
    elif 'csv' in file_type.lower():
      return FromCSVToDFConverter()
    elif 'pqt' in file_type.lower():
      return FromParaquetToDFConverter()
    else:
      raise ValueError(f"Unsupported type: {file_type}")

  @staticmethod
  def create_json_converter(file_type: str) -> MetadataFormatter:
    if 'txt' in file_type.lower():
      return TextToJsonConverter()
    else:
      raise ValueError(f"Unsupported type: {file_type}")

  @staticmethod
  def create_byte_converter(file_type: str):
    if ('xml' in file_type.lower()
        or 'bpmn' in file_type.lower()
        or 'txt' in file_type.lower()):
      return XMLToElementConverter()
    else:
      raise ValueError(f"Unsupported type: {file_type}")

  @staticmethod
  def create_transport_converter(file_type: str) -> TransportFormatter:
    if file_type in ("json", "txt", "bpmn", "xml"):
      return BytesToStringConverter()
    else:
      raise ValueError(f"Unsupported type: {file_type}")