import datetime
from pathlib import Path
import time
from threading import Lock

import pytz
from flask import Flask, jsonify
from flask_cors import CORS
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

local_tz = pytz.timezone("Asia/Tokyo")

SCOPE = ['https://www.googleapis.com/auth/calendar.readonly']

SERVICE_ACCOUNT_FILE = Path(r'C:\Users\yakim\cernbox\Code\=Fix=\SAOCalendar\.secrets\Google_calendar_service_key.json')
CAL_IDS_PATH = Path(r'C:\Users\yakim\cernbox\Code\=Fix=\SAOCalendar\.secrets\cal_ids.txt')

CACHE_TTL_SECONDS = 60
_cache_lock = Lock()
_cache = {
    'fetched_at': 0.0,
    'events': [],
}

def fetch_events():
    try:
        service = build(
            'calendar',
            'v3',
            credentials=Credentials.from_service_account_file(
                str(SERVICE_ACCOUNT_FILE),
                scopes=SCOPE,
            ),
        )
        with open(CAL_IDS_PATH, 'r', encoding='utf-8') as file:
            calendar_ids = [line.strip() for line in file if line.strip()]

        now = datetime.datetime.now(local_tz)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + datetime.timedelta(days=1)
        start_of_day_utc = start_of_day.astimezone(pytz.utc).isoformat()
        end_of_day_utc = end_of_day.astimezone(pytz.utc).isoformat()

        all_events = []

        def fetch_events_from_calendar(calendar_id, source_index: int):
            events_result = service.events().list(
                calendarId=calendar_id,
                timeMin=start_of_day_utc,
                timeMax=end_of_day_utc,
                singleEvents=True, orderBy='startTime'
            ).execute()
            events = events_result.get('items', [])
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                end = None
                if 'end' in event:
                    end = event['end'].get('dateTime', event['end'].get('date'))
                if end is None:
                    end = start
                all_events.append(
                    {
                        'start': start,
                        'end': end,
                        'summary': event.get('summary', ''),
                        'source': source_index,
                    }
                )

        # Fetch events from all calendars
        for idx, calendar_id in enumerate(calendar_ids):
            fetch_events_from_calendar(calendar_id, source_index=idx)

        all_events.sort(key=lambda x: x['start'])
        return all_events
    except Exception as e:
        raise RuntimeError(f"Error fetching events: {e}") from e


def get_events_cached():
    now = time.time()
    with _cache_lock:
        cached_events = _cache['events']
        fetched_at = _cache['fetched_at']
        if cached_events and (now - fetched_at) < CACHE_TTL_SECONDS:
            return cached_events

    try:
        fresh = fetch_events()
    except Exception:
        with _cache_lock:
            if _cache['events']:
                return _cache['events']
        raise

    with _cache_lock:
        _cache['events'] = fresh
        _cache['fetched_at'] = now
    return fresh


@app.route('/events')
def events():
    try:
        events = get_events_cached()
        return jsonify(events)
    except Exception as e:
        return jsonify({"error": "Failed to fetch events", "detail": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=False)
