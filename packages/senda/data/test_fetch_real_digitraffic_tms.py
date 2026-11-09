"""Tests the wire schema using a minimal contract example; never commits example to observation database."""
import datetime as dt
import unittest
from fetch_real_digitraffic_tms import normalize_tms, parsed_utc

NOW=dt.datetime.fromisoformat("2026-11-06T03:00:00+00:00")
WIRE={
 "dataUpdatedTime":"2026-11-06T02:56:00Z",
 "tmsStations":[{
   "id":23001,"tmsNumber":1,"measuredTime":"2026-11-06T02:56:00Z",
   "sensorValues":[
     {"id":5054,"roadStationId":23001,"name":"PASSES_60MIN_FIXED_DIRECTION1",
      "sensorValue":470.0,"sensorUnit":"pcs/h","timeWindowStart":"2026-11-06T02:00:00Z"},
     {"id":5055,"roadStationId":23001,"name":"AVERAGE_SPEED_5MIN_DIRECTION1",
      "sensorValue":61.0,"sensorUnit":"km/h","timeWindowStart":"2026-11-06T02:55:00Z"}]}]}

class WireShapeTest(unittest.TestCase):
 def test_schema_and_time_are_parsed_but_not_cleared_for_emergency_use(self):
  q=normalize_tms(WIRE,23001,NOW)
  self.assertEqual(q["station_id"],23001)
  self.assertEqual(q["freshness"],"CURRENT")
  self.assertEqual(q["number_of_numeric_readings"],2)
  self.assertFalse(q["operational_safety_clearance"])
 def test_real_2026_single_station_wire_format_is_supported(self):
  wire={"id":23001,"tmsNumber":1,"dataUpdatedTime":"2026-11-06T02:59:00Z",
        "sensorValues":[{"id":5054,"stationId":23001,"name":"OHITUKSET_60MIN_KIINTEA_SUUNTA1",
          "measuredTime":"2026-11-06T02:57:00Z",
          "timeWindowStart":"2026-11-06T02:00:00Z",
          "timeWindowEnd":"2026-11-06T03:00:00Z",
          "unit":"kpl/h","value":222.0}]}
  q=normalize_tms(wire,23001,NOW)
  self.assertEqual(q["number_of_numeric_readings"],1)
  self.assertEqual(q["records"][0]["sensor_name"],"OHITUKSET_60MIN_KIINTEA_SUUNTA1")
  self.assertEqual(q["records"][0]["value"],222.0)
  self.assertEqual(q["records"][0]["time_basis"],"SENSOR_MEASURED_TIME")
  self.assertEqual(q["station_time_basis"],"PUBLISHER_UPDATED_TIME_PROXY")
 def test_invalid_old_or_wrong_station_rejected(self):
  with self.assertRaises(ValueError): normalize_tms(WIRE,23002,NOW)
  with self.assertRaises(ValueError): normalize_tms(WIRE,23001,dt.datetime(2026,12,7,tzinfo=dt.timezone.utc))
 def test_timezones_not_dropped(self):
  self.assertEqual(parsed_utc("2026-11-06T04:00:00+01:00").isoformat(),"2026-11-06T03:00:00+00:00")
  with self.assertRaises(ValueError): parsed_utc("2026-11-06T03:00:00")
 def test_missing_invalid_numeric_values_are_not_converted_to_zero(self):
  w={"tmsStations":[{**WIRE["tmsStations"][0],
     "sensorValues":[{"name":"X","sensorValue":None,"sensorUnit":"km/h"},
                     {"name":"OK","sensorValue":10,"sensorUnit":"km/h"}]}]}
  q=normalize_tms(w,23001,NOW)
  self.assertEqual(q["number_of_numeric_readings"],1)
  self.assertEqual(q["records"][0]["sensor_name"],"OK")

if __name__=="__main__":unittest.main()
