import json
import threading
from collections import deque
from flask import Flask, jsonify, request, Response # type: ignore

app = Flask(__name__)

# In-memory state shared between the detector (writer) and the SSE streams
# (readers). Every detection gets the next `seq` and is kept in a short log, so
# each connected client is sent every detection exactly once, in order, even
# if several arrive before the stream thread wakes up.
_state = {"seq": 0}
_log = deque(maxlen=256)  # (seq, name); a stream more than 256 behind skips ahead
_cond = threading.Condition()


@app.route('/exercise', methods=['POST'])
def post_exercise():
    """Called by exercise_detection.py whenever it detects a completed rep."""
    payload = request.get_json(silent=True) or {}
    name = payload.get('exercise')
    if not name:
        return jsonify({"error": "missing 'exercise'"}), 400

    with _cond:
        _state["seq"] += 1
        seq = _state["seq"]
        _log.append((seq, name))
        _cond.notify_all()

    return jsonify({"ok": True, "seq": seq})


@app.route('/events')
def events():
    """Server-Sent Events stream consumed by the React app via EventSource."""
    with _cond:
        # Start from "now": a client that (re)connects must not replay a rep
        # someone did before it was listening.
        start_seq = _state["seq"]

    def stream():
        last_seq = start_seq
        # Open the stream with a comment so the client connects immediately.
        yield ": connected\n\n"
        while True:
            with _cond:
                _cond.wait_for(lambda: _state["seq"] != last_seq, timeout=15)
                pending = [(s, n) for s, n in _log if s > last_seq]
            if pending:
                for seq, name in pending:
                    yield f"data: {json.dumps({'exercise': name, 'seq': seq})}\n\n"
                last_seq = pending[-1][0]
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
    # debug stays off: the Werkzeug debugger allows code execution from the browser.
    app.run(threaded=True)
