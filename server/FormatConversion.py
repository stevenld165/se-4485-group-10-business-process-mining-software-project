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
    json_data = json.loads(raw.decode('utf-8'))
    if self._is_ocel_format(json_data):
      return self._handle_ocel(json_data)
    return self._handle_standard_json(json_data)

  def _is_ocel_format(self, data: dict) -> bool:
    return (isinstance(data, dict) and
            'ocel' in data and
            'events' in data and
            isinstance(data['events'], list))

  def _handle_ocel(self, ocel_data: dict) -> pd.DataFrame:
    try:
      events = ocel_data.get('events', [])
      if not events:
        raise ValueError("OCEL format detected but 'events' array is empty")
      df = pd.DataFrame(events)
      self._make_tabular(df)
      if 'attributes' in df.columns:
        self._denormalize_attributes_col(df)
      return df

    except Exception as e:
      raise ValueError(
        f"Failed to convert OCEL format: {str(e)}\n"
        f"Expected 'events' array with standard event structure."
      ) from e

  def _make_tabular(self, dataframe: pd.DataFrame) -> None:
    for col in ['ocel:type', 'ocel:omap']:
      if col in dataframe.columns:
        dataframe[col] = dataframe[col].apply(
          lambda x: '|'.join(str(v) for v in x)
          if isinstance(x, list)
          else str(x)
        )

  def _denormalize_attributes_col(self, dataframe: pd.DataFrame) -> None:
    if (dataframe['attributes'].dtype == 'object' and
        isinstance(dataframe['attributes'].iloc[0], dict)):

      attributes_df = pd.json_normalize(dataframe['attributes'])

      dataframe.drop(columns=['attributes'], inplace=True)

      for col in attributes_df.columns:
        dataframe[col] = attributes_df[col]

  def _handle_standard_json(self, data: dict) -> pd.DataFrame:
    return pd.DataFrame(data)

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
    elif 'parquet' in file_type.lower():
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