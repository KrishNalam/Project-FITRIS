import React, { useCallback, useRef, useState } from 'react';
import './App.css';
import Tetris from './components/Tetris';
import Camera from './components/Camera';

function App() {
  // Latest exercise as { exercise, seq }. A fresh object with a new seq for
  // every rep, so repeating the same exercise still triggers each time.
  const [event, setEvent] = useState(null);
  const seq = useRef(0);
  const onExercise = useCallback((exercise) => {
    seq.current += 1;
    setEvent({ exercise, seq: seq.current });
  }, []);

  return (
    <div className="App">
      <Tetris event={event}>
        <Camera onExercise={onExercise} />
      </Tetris>
    </div>
  );
}

export default App;
