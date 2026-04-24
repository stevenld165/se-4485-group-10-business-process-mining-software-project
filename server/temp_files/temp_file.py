import pandas as pd
from websockets import Response

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from ArtifactValidation import Validator
from FormatConversion import ConverterFactory

import os

from ArtifactSaving import InstanceSaver
from EventLogLogic import EventLogFactory, OCEventLog, CCEventLog
from FormatConversion import MetadataFormatter
from MetaDataAnnotation import MetaDataAggregator
from server.temp_files.DiscoveryLogic import DiscoveryFactory
from server.temp_files.ElogFlatteners import OCELFlattener



# Traces to Use Case 1
class GraphConstructor:
  allowed_extensions_event_log = ['csv', 'json', 'xml']
  allowed_extensions_graph = ['bpmn']
  allowed_structures_ocel = ['event_id', 'object_id', 'object_type', 'activity', 'timestamp', 'actor']
  allowed_structures_ccel = ['case_id', 'activity', 'timestamp', 'actor']

  # def __init__(self, app: FastAPI):
  #   self.app = app
  #   app.add_api_route(
  #     "/process-event-log",
  #     self.construct_graph_from_log,
  #     methods=["POST"]
  #   )

  @staticmethod
  def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[-1].lower()

  def get_file_name(self, filename: str) -> str:
    return filename.rstrip(self.get_file_extension(filename)).rstrip('.')

  def validate_event_log_structure(self, user_input: pd.DataFrame) -> str:
    ocel_structure_validator = Validator.create_structure_validator("OCEL", OCEventLog.allowed_structures_ocel)
    ccel_structure_validator = Validator.create_structure_validator("CCEL", CCEventLog.allowed_structures_ccel)
    if ocel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ocel"
    elif ccel_structure_validator.validate_structure(user_input.columns.tolist()):
      return "ccel"
    else:
      return "error"

  async def construct_graph_from_log(self, file: UploadFile = File(...)):
    content = await file.read()
    file_type = self.get_file_extension(file.filename)
    input_validator = Validator.create_format_validator(
      "EventLog",
      self.allowed_extensions_event_log)

    if input_validator.validate_file_type(self.get_file_extension(file.filename)):

      file_converter = ConverterFactory.create_df_converter(file_type)
      formatted_input = file_converter.convert_from(content)
      type_of_elog = self.validate_event_log_structure(formatted_input)

      event_log = EventLogFactory.create_elog(
        type_of_elog,
        file_contents = formatted_input,
        file_type = file_type.strip('.')
      )

      saver = InstanceSaver()

      event_log_meta = MetaDataAggregator.formulate(
        object_id = None,
        object_type = type_of_elog,
        file_format = "parquet",
        source_filename = file.filename,
      )

      el_id = saver.save_elog(
        event_log,
        formatted_input,
        event_log_meta,
      )

      elog_to_df = ConverterFactory.create_df_converter('pqt')
      saved_contents = elog_to_df.convert_from(event_log.read_event_log())
      if isinstance(event_log, OCEventLog):
        sub_eLog, sub_content = OCELFlattener().simplify_eLog(event_log, file_type.strip('.'))
        sub_event_log_meta = MetaDataAggregator.formulate(
          object_id=None,
          object_type='CCEL',
          file_format="parquet",
          source_filename=f"sub_log_{el_id}",
        )
        el_sub_id = saver.save_elog(
          sub_eLog,
          sub_content,
          sub_event_log_meta
        )
        saved_contents = elog_to_df.convert_from(sub_eLog.read_event_log())

      discoverer = DiscoveryFactory.create('CCEL')
      discoverer.discover_process()



    # ^^^ create the appropriate event logs ^^^, write to system, read event log,
    # discovery alg, write graph, read graph, send response with graph

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