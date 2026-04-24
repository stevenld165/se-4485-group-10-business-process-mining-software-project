from abc import ABC, abstractmethod

from server.temp_files.EventLogLogic import EventLog, OCEventLog, CCEventLog
import pandas as pd

import pm4py
from pm4py.objects.conversion.log import converter as log_converter


class GraphConstructor:
  @staticmethod
  def start(self):
    return

class DiscoveryAlg(ABC):
  @abstractmethod
  def discover_process(self, log: EventLog):
    pass
  # figure out what it outputs; either a graph object, or a file formatted to be written to a graph

# class OCELDiscovery(DiscoveryAlg):
#   def discover_process(self, log: OCEL):
#     # mining algorithm specific to object centric event log
#     return

class CCELDiscovery(DiscoveryAlg):
  def discover_process(self, df: pd.DataFrame):
    event_log = log_converter.apply(df)
    return pm4py.discover_bpmn_inductive(event_log)

class DiscoveryFactory:
  @staticmethod
  def create(log: str):
    # if isinstance(log, OCEventLog):
    #   return OCELDiscovery()
    # elif isinstance(log, CCEventLog):
    return CCELDiscovery()