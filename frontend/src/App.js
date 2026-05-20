// App.js

import React, { useState, useEffect } from 'react';
import './App.css';
import Tetris from './components/Tetris';

function App() {
  // Latest exercise event from the backend: { exercise, seq } or null.
  const [event, setEvent] = useState(null);

  useEffect(() => {
    // Subscribe to the backend's Server-Sent Events stream. The CRA dev
    // server proxies /events to Flask (see "proxy" in package.json).
    // EventSource auto-reconnects on error, so no manual retry is needed.
    const source = new EventSource('/events');

    source.onmessage = (e) => {
      try {
        setEvent(JSON.parse(e.data));
      } catch (err) {
        // Ignore malformed payloads / heartbeats.
      }
    };

    return () => source.close();
  }, []);

  return (
    <div className="App">
      <Tetris event={event} />
    </div>
  );
}

export default App;
