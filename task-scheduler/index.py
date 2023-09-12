import math
from flask import Flask, request, jsonify
from schedule_ortools import schedule
import pandas as pd
import traceback

app = Flask(__name__)


@app.route("/", methods=['POST'])
def schedule_events():
    try:
        data = request.get_json()
        tasks = pd.json_normalize(data['events'])
        reserved_tags = pd.json_normalize(data['reservedTags'])
        result = schedule(tasks, reserved_tags, data['start'])
        return result, 200
    except Exception as e:
        traceback.print_exception(e)
        return 'An error occurred', 500