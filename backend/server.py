import json
import threading
from flask import Flask, jsonify, request, Response # type: ignore

app = Flask(__name__)

# In-memory state shared between the detector (writer) and the SSE stream
# (readers). `seq` increments on every detection so that two identical
# exercises in a row are still delivered as two distinct events.
_state = {"name": None, "seq": 0}
_cond = threading.Condition()


@app.route('/exercise', methods=['POST'])
def post_exercise():
    """Called by exercise_detection.py whenever it detects a completed rep."""
    payload = request.get_json(silent=True) or {}
    name = payload.get('exercise')
    if not name:
        return jsonify({"error": "missing 'exercise'"}), 400

    with _cond:
        _state["name"] = name
        _state["seq"] += 1
        seq = _state["seq"]
        _cond.notify_all()

    return jsonify({"ok": True, "seq": seq})


@app.route('/events')
def events():
    """Server-Sent Events stream consumed by the React app via EventSource."""
    def stream():
        last_seq = 0
        # Open the stream with a comment so the client connects immediately.
        yield ": connected\n\n"
        while True:
            with _cond:
                _cond.wait(timeout=15)
                seq = _state["seq"]
                name = _state["name"]
            if seq != last_seq:
                last_seq = seq
                yield f"data: {json.dumps({'exercise': name, 'seq': seq})}\n\n"
            else:
                # Heartbeat (a comment) keeps the connection alive through
                # proxies; EventSource ignores comment lines.
                yield ": ping\n\n"

    return Response(stream(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    })


if __name__ == '__main__':
    # threaded=True so a long-lived SSE connection doesn't block the POSTs
    # coming from the detector.
    app.run(debug=True, threaded=True)
