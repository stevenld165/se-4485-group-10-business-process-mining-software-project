from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import tempfile

import pandas as pd
from pm4py.objects.conversion.log import converter as log_converter
from pm4py.algo.discovery.dfg import algorithm as dfg_discovery
from pm4py.visualization.dfg import visualizer as dfg_visualizer
from pm4py.algo.discovery.inductive import algorithm as inductive_miner
from pm4py.visualization.petri_net import visualizer as pn_visualizer
from pm4py.objects.bpmn.exporter import exporter as bpmn_exporter
from io import BytesIO
import pm4py

app = FastAPI()

origins = ["*"]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

@app.get("/")
def read_root():
  return {"hello": "World"}

@app.get("/event-log")
def read_event_log():
  df = pd.read_csv('examples/data_log.csv')

  return df.head(50).to_dict(orient="records")

@app.get("/diagram")
def read_diagram():
  df = pd.read_csv('examples/data_log.csv')

  # Convert the 'Timestamp' column to a datetime format
  df['Timestamp'] = pd.to_datetime(df['Timestamp'])

  # Use the exact column names from the diagnostic output
  df.rename(columns={'Case_ID': 'case:concept:name',
                    'Activity': 'concept:name',
                    'Timestamp': 'time:timestamp'}, inplace=True)

  # Convert the DataFrame to a PM4Py event log object
  event_log = log_converter.apply(df)

  bpmn_graph = pm4py.discover_bpmn_inductive(event_log)

  temp_file = tempfile.NamedTemporaryFile(
    mode='w',
    suffix='.bpmn',
    delete=False
  )

  temp_file_path = temp_file.name
  temp_file.close()

  pm4py.write_bpmn(bpmn_graph, temp_file_path)



  return FileResponse(
    path=temp_file_path,
    media_type="application/xml",
    filename="discovered_process.bpmn"
  )