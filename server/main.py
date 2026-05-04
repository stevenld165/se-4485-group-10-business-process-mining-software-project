import pandas as pd
import json
import os
import tempfile
import uvicorn

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from ArtifactValidation import Validator
from FormatConversion import ConverterFactory

from ArtifactSaving import InstanceSaver
from EventLogLogic import EventLogFactory, OCEventLog, CCEventLog, EventLog
from MetaDataAnnotation import MetaDataAggregator
from ArtifactBundler import ArtifactBundler
from ArtifactUnbundler import BundleUnpacker
from DiagramLogic import DiagramFactory
from DiscoveryLogic import DiscoveryFactory
from ElogFlatteners import OCELFlattener
from Elog_Normalizer import Normalizer, DeNormalizer
from FileResponses import ConstructGraphResponse


# Traces to Use Case 1
class GraphConstructor:
  allowed_extensions_event_log = ['csv', 'json', 'xml']
  allowed_extensions_graph = ['bpmn']

  def __init__(self, app: FastAPI):
    self.app = app
    app.add_api_route(
      "/diagram",
      self.construct_graph_from_log,
      methods=["POST"]
    )
    self._object_factory()

  def _object_factory(self):
    self.input_validator = Validator.create_format_validator(
      "EventLog",
      self.allowed_extensions_event_log
    )
    self.ocel_structure_validator = Validator.create_structure_validator(
      "OCEL",
      OCEventLog.allowed_structures_ocel
    )
    self.ccel_structure_validator = Validator.create_structure_validator(
      "CCEL",
      CCEventLog.allowed_structures_ccel
    )
    self.saver = InstanceSaver()
    self.log_and_graph_bundler = ArtifactBundler()

  def _get_file_extension(self, filename: str) -> str:
    return os.path.splitext(filename)[-1].lower()

  def _get_file_name(self, filename: str) -> str:
    return filename.rstrip(self._get_file_extension(filename)).rstrip('.')

  def _validate_event_log_structure(self, user_input: pd.DataFrame) -> str:
    if self.ocel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ocel"
    elif self.ccel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ccel"
    else:
      raise ValueError(f"Columns necessary not present. Necessary columns are: \n"
                       f"CCEL -- {CCEventLog.allowed_structures_ccel}\n"
                       f"OCEL -- {OCEventLog.allowed_structures_ocel}\n"
                       f"Your Structure -- {user_input.columns.tolist()}")


  def _elog_for_inductive_mining(self, elog: EventLog, object_ids: list) -> pd.DataFrame:
    if isinstance(elog, OCEventLog):
      sub_elog, sub_content = OCELFlattener().simplify_eLog(elog, elog.file_format)
      sub_event_log_meta = MetaDataAggregator.formulate(
        object_id=None,
        object_type='CCEL',
        file_format="parquet",
        source_filename=f"sub_log_{object_ids[0]}",
      )
      object_ids.append(
        self.saver.save_elog(
          sub_elog,
          sub_content,
          sub_event_log_meta
        )
      )
      return sub_elog.read_event_log()
    elif isinstance(elog, CCEventLog):
      return elog.read_event_log()

  def _pack_to_temp_file(self, result: dict) -> str:
    temp_file = tempfile.NamedTemporaryFile(
      mode="w",
      suffix=".json",
      delete=False
    )

    json.dump(result, temp_file, indent=2)
    temp_file.close()
    return temp_file.name

  async def construct_graph_from_log(self, file: UploadFile = File(...)):
    content = await file.read()
    extension_with_dot = self._get_file_extension(file.filename)  # Returns '.csv'
    file_type = extension_with_dot[1:] if extension_with_dot.startswith('.') else extension_with_dot

    if not self.input_validator.validate_file_type(file_type):
      raise TypeError(f"File Format Not Supported: {file_type}")
    file_converter = ConverterFactory.create_df_converter(file_type)
    formatted_input = file_converter.convert_from(content)
    formatted_input = Normalizer.normalize_columns(formatted_input)
    type_of_elog = self._validate_event_log_structure(formatted_input)

    event_log = EventLogFactory.create_elog(
      type_of_elog.upper(),
      file_contents = formatted_input,
      file_type = 'parquet'
    )

    event_log_meta = MetaDataAggregator.formulate(
      object_id = None,
      object_type = type_of_elog.upper(),
      file_format = "parquet",
      source_filename = file.filename,
    )

    object_ids = list()
    object_ids.append(
      self.saver.save_elog(
        event_log,
        event_log.file_contents,
        event_log_meta,
      )
    )

    saved_contents = self._elog_for_inductive_mining(event_log, object_ids)
    saved_contents = DeNormalizer.denormalize_for_pm4py(saved_contents)
    discoverer = DiscoveryFactory.create('CCEL')
    role_to_activities = discoverer.get_role_activities(saved_contents)
    new_BPMN = discoverer.discover_process(saved_contents)

    new_swimlane = DiagramFactory.create_diagram('Swimlane', "bpmn", new_BPMN)

    diagram_meta = MetaDataAggregator.formulate(
      object_id = None,
      object_type = 'Swimlane',
      file_format = new_swimlane.file_type,
      source_filename=f"swimlane_{object_ids[0]}"
    )
    object_ids.append(
      self.saver.save_graph(
        new_swimlane,
        new_swimlane.file_contents,
        diagram_meta,
        role_map = role_to_activities
      )
    )

    bundle_id = self.log_and_graph_bundler.bundle_artifacts(
      object_ids,
      label = self._get_file_name(file.filename)
    )

    log_and_graph_unpacked = BundleUnpacker(bundle_id)

    response_creator = ConstructGraphResponse()
    result = response_creator.build_response(
        log_and_graph_unpacked,
        bundle_id,
        role_to_activities
      )

    temp_file_name = self._pack_to_temp_file(result)

    return FileResponse(
      path = temp_file_name,
      filename=f"{bundle_id}.json",
      media_type="application/json"
    )

def _create_app() -> FastAPI:
  app = FastAPI()

  origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]

  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Solves "Missing Access-Control-Allow-Origin"
    allow_credentials=True,
    allow_methods=["*"],  # Required for the 'Preflight' OPTIONS request
    allow_headers=["*"],  # Allows 'Content-Type', 'Authorization', etc.
  )

  GraphConstructor(app)
  return app

app = _create_app()


if __name__ == "__main__":
  uvicorn.run(app, host="0.0.0.0", port=8000)