from io import BytesIO
import pandas as pd
import xml.etree.ElementTree as ET

from ArtifactUnbundler import BundleUnpacker


class ConstructGraphResponse:
  def build_response(
      self,
      log_and_graph_unpacked: BundleUnpacker,
      bundle_id: str,
      role_to_activities: dict
    ) -> dict:

    types = log_and_graph_unpacked.types()

    if "CCEL" not in types or "Swimlane" not in types:
      raise ValueError("Invalid bundle: CCEL and Swimlane are required")

    response = {
      "bundle_id": bundle_id,
      "includes_ocel": "OCEL" in types,
      "contents": {
        "ccel": {
          "data": self._safe_json_elog(log_and_graph_unpacked["CCEL"]),
          "type": "event_log",
          "metadata": log_and_graph_unpacked.meta("CCEL")
        },
        "swimlane": {
          "data": self._safe_json_graph(log_and_graph_unpacked["Swimlane"]),
          "type": "bpmn",
          "metadata": log_and_graph_unpacked.meta("Swimlane"),
          "roles": role_to_activities
        }
      }
    }

    # Optional OCEL
    if "OCEL" in types:
      response["contents"]["ocel"] = {
        "data": self._safe_json_elog(log_and_graph_unpacked["OCEL"]),
        "type": "event_log",
        "metadata": log_and_graph_unpacked.meta("OCEL")
      }

    return response

  def _safe_json_elog(self, data):
    if isinstance(data, bytes):
      temp_df = pd.read_parquet(BytesIO(data))
      return temp_df.to_dict(orient="records")
    return data

  def _safe_json_graph(self, data):
    if isinstance(data, bytes):
      return data.decode('utf-8')
    elif isinstance(data, ET.Element):
      xml_string = ET.tostring(data, encoding='utf-8').decode('utf-8')
      return self._prettify_xml(xml_string)
    elif isinstance(data, str):
      return self._prettify_xml(data)
    return data

  def _prettify_xml(self, xml_string: str) -> str:
    try:
      declaration = ""
      if xml_string.strip().startswith('<?xml'):
        decl_end = xml_string.find('?>') + 2
        declaration = xml_string[:decl_end]
        xml_string_without_decl = xml_string[decl_end:].lstrip()
      else:
        xml_string_without_decl = xml_string
      root = ET.fromstring(xml_string_without_decl)
      self._indent_xml(root)
      formatted = ET.tostring(root, encoding='unicode')
      if declaration:
        return declaration + "\n" + formatted
      else:
        return formatted
    except Exception as e:
      return xml_string

  def _indent_xml(self, elem, level=0):
    indent = "\n" + level * "  "
    if len(elem):
      if not elem.text or not elem.text.strip():
        elem.text = indent + "  "
      if not elem.tail or not elem.tail.strip():
        elem.tail = indent
      for i, child in enumerate(elem):
        self._indent_xml(child, level + 1)
        if not child.tail or not child.tail.strip():
          if i < len(elem) - 1:
            child.tail = indent + "  "  # Siblings stay indented
          else:
            child.tail = indent
    else:
      if level and (not elem.tail or not elem.tail.strip()):
        elem.tail = indent