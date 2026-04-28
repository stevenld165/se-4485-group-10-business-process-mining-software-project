import pandas as pd
from websockets import Response

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from ArtifactValidation import Validator
from FormatConversion import ConverterFactory

import os

from ArtifactSaving import InstanceSaver
from EventLogLogic import EventLogFactory, OCEventLog, CCEventLog, EventLog
from FormatConversion import MetadataFormatter
from MetaDataAnnotation import MetaDataAggregator
from server.temp_files.ArtifactBundler import ArtifactBundler
from server.temp_files.ArtifactUnbundler import BundleUnpacker
from server.temp_files.DiagramLogic import DiagramFactory
from server.temp_files.DiscoveryLogic import DiscoveryFactory
from server.temp_files.ElogFlatteners import OCELFlattener



# Traces to Use Case 1
class GraphConstructor:
  allowed_extensions_event_log = ['csv', 'json', 'xml']
  allowed_extensions_graph = ['bpmn']

  # def __init__(self, app: FastAPI):
  #   self.app = app
  #   app.add_api_route(
  #     "/process-event-log",
  #     self.construct_graph_from_log,
  #     methods=["POST"]
  #   )
  #   self._object_factory()

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
    return filename.rstrip(self.get_file_extension(filename)).rstrip('.')

  def _validate_event_log_structure(self, user_input: pd.DataFrame) -> str:
    if self.ocel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ocel"
    elif self.ccel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ccel"
    else:
      return "error"

  def _format_for_inductive_mining(self, elog: EventLog, object_ids: list) -> pd.DataFrame:
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

  async def construct_graph_from_log(self, file: UploadFile = File(...)):
    content = await file.read()
    file_type = self._get_file_extension(file.filename)

    if self.input_validator.validate_file_type(self._get_file_extension(file.filename)):

      file_converter = ConverterFactory.create_df_converter(file_type)
      formatted_input = file_converter.convert_from(content)
      type_of_elog = self._validate_event_log_structure(formatted_input)

      event_log = EventLogFactory.create_elog(
        type_of_elog,
        file_contents = formatted_input,
        file_type = file_type.strip('.')
      )

      object_ids = list()

      event_log_meta = MetaDataAggregator.formulate(
        object_id = None,
        object_type = event_log.file_format,
        file_format = "parquet",
        source_filename = file.filename,
      )

      object_ids.append(
        self.saver.save_elog(
          event_log,
          event_log.file_contents,
          event_log_meta,
        )
      )

      saved_contents = self._format_for_inductive_mining(event_log, object_ids)
      discoverer = DiscoveryFactory.create('CCEL')
      new_BPMN = discoverer.discover_process(saved_contents)

      new_swimlane = DiagramFactory.create_diagram('Swimlane', "bpmn", new_BPMN, )

      diagram_meta = MetaDataAggregator.formulate(
        object_id = None,
        object_type = 'Swimlane',
        file_format = new_swimlane.file_format,
        source_filename=f"swimlane_{object_ids[0]}"
      )
      object_ids.append(
        self.saver.save_graph(
          new_swimlane,
          new_swimlane.file_contents,
          diagram_meta
        )
      )

      bundle_id = self.log_and_graph_bundler.bundle_artifacts(
        *object_ids,
        label = self._get_file_name(file.filename)
      )

      log_and_graph_unpacked = BundleUnpacker(bundle_id)


    return


  def start(self):
    return

def main():
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

  use_case_1 = GraphConstructor(app)

  use_case_1.construct_graph_from_log()



if __name__ == "__main__":
  main()