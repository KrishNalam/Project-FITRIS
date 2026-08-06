"""Run: python backend/test_backend.py  (needs numpy + flask, no webcam)."""
import json
import threading
import time

from reps import RepCounter, calculate_angle
import server

ALL = {'jj': True, 'squat': True, 'sway': True, 'flex': True}
# Standing straight, arms by the sides.
STAND = dict(hsw1=10, hsw2=10, sha1=178, sha2=178, hka1=175, hka2=175,
             sew1=170, sew2=170, csw1=90, csw2=90, esh1=10, esh2=10)


def run(frames):
    c, out = RepCounter(), []
    for f in frames:
        out += c.update({**STAND, **f}, ALL)
    return out


def test_angle():
    assert round(calculate_angle([1, 0], [0, 0], [0, 1])) == 90
    assert round(calculate_angle([-1, 0], [0, 0], [1, 0])) == 180


def test_squat_with_arms_down():
    # Used to fail: the jumping-jack check overwrote the shared 'sqdown' stage.
    assert run([{}, dict(hka1=90, hka2=90, sha1=150, sha2=150), {}]) == ['Squat']


def test_half_squat_not_counted():
    assert run([{}, dict(hka1=120, hka2=120), {}]) == []


def test_jumping_jack():
    up = dict(hsw1=170, hsw2=170, sha1=160, sha2=160)
    assert run([{}, up, {}, up, {}]) == ['Jumping Jack', 'Jumping Jack']


def test_sway_needs_return_to_neutral():
    right = dict(csw1=160, hsw1=100)
    assert run([{}, right, right, {}, right]) == ['Sway Right', 'Sway Right']


def test_flex_once_per_pose():
    flex = dict(esh1=80, esh2=80, sew1=40, sew2=40, hsw1=120, hsw2=120)
    assert run([{}, flex, flex, {}, flex]) == ['Flex', 'Flex']


def read_events(resp, n, out):
    for chunk in resp.response:
        line = chunk.decode() if isinstance(chunk, bytes) else chunk
        if line.startswith('data:'):
            out.append(json.loads(line[5:]))
            if len(out) == n:
                return


def test_sse_no_replay_and_no_drops():
    client = server.app.test_client()
    client.post('/exercise', json={'exercise': 'Squat'})  # before anyone listens

    got = []
    resp = client.get('/events')
    t = threading.Thread(target=read_events, args=(resp, 3, got), daemon=True)
    t.start()
    time.sleep(0.2)
    for name in ['Flex', 'Squat', 'Flex']:  # burst faster than the stream wakes
        client.post('/exercise', json={'exercise': name})
    t.join(timeout=5)

    assert [e['exercise'] for e in got] == ['Flex', 'Squat', 'Flex'], got
    seqs = [e['seq'] for e in got]
    assert seqs == sorted(set(seqs)), seqs


def test_missing_exercise_400():
    assert server.app.test_client().post('/exercise', json={}).status_code == 400


if __name__ == '__main__':
    for name, fn in list(globals().items()):
        if name.startswith('test_'):
            fn()
            print('ok', name)
