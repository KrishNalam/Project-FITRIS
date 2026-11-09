import React, { useState, useEffect } from 'react';
import { createEmptyGrid, checkCollision, GRID_WIDTH, GRID_HEIGHT, randomTetromino } from './helpers';
import GameGrid from './GameGrid';
import './Tetris.css';

const startPos = () => ({ x: Math.floor(GRID_WIDTH / 2) - 1, y: 0 });
const LOGO = [['F', '#ff2b4a'], ['I', '#ff9f1a'], ['T', '#ffe81a'], ['R', '#2bff5e'], ['I', '#00e5ff'], ['S', '#b026ff']];

// A piece centred in a small 4x4 window (hold / next previews).
const Preview = ({ shape, color }) => {
  const pos = shape
    ? { x: Math.floor((4 - shape[0].length) / 2), y: Math.floor((4 - shape.length) / 2) }
    : { x: 0, y: 0 };
  return <GameGrid className="mini" grid={createEmptyGrid(4, 4)} tetromino={shape} tetrominoPos={pos} colours={color} />;
};

const Tetris = ({ event, children }) => {
  // Lazy initial state: the game is ready on the first render, so there is no
  // window where the gravity timer or a key press sees an undefined piece.
  const [first] = useState(randomTetromino);
  const [grid, setGrid] = useState(() => createEmptyGrid());
  const [tetromino, setTetromino] = useState(first.shape);
  const [tetrominoPos, setTetrominoPos] = useState(startPos);
  const [gameOver, setGameOver] = useState(false);
  const [colours, setColours] = useState(first.color);
  const [hold, setHold] = useState(null);
  const [hasHeld, setHasHeld] = useState(false);
  const [nextThreeTetrominos, setNextThreeTetrominos] = useState(() => [randomTetromino(), randomTetromino(), randomTetromino()]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);

  const storedHighScore = localStorage.getItem('highscore');
  const highest = storedHighScore ? parseInt(storedHighScore, 10) : 0;

  useEffect(() => {
    const dropInterval = setInterval(() => {
      if (!gameOver) {
        dropTetromino();
      }
    }, 500);
    return () => clearInterval(dropInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tetrominoPos, tetromino, grid, colours, gameOver]);

  const resetGame = () => {
    const piece = randomTetromino();
    setGrid(createEmptyGrid());
    setTetromino(piece.shape);
    setColours(piece.color);
    setTetrominoPos(startPos());
    setNextThreeTetrominos([randomTetromino(), randomTetromino(), randomTetromino()]);
    setHold(null);
    setHasHeld(false);
    setScore(0);
    setLines(0);
    setGameOver(false);
  };

  const moveTetromino = (dx, dy) => {
    if (!checkCollision(tetromino, grid, { x: tetrominoPos.x + dx, y: tetrominoPos.y + dy })) {
      setTetrominoPos((prevPos) => ({
        x: prevPos.x + dx,
        y: prevPos.y + dy,
      }));
    }
  };

  const rotateTetromino = () => {
    // Transpose, then reverse each row: a clockwise rotation.
    const transposed = tetromino[0].map((_, i) => tetromino.map((row) => row[i]));
    const rotatedTetromino = transposed.map((row) => row.reverse());
    if (!checkCollision(rotatedTetromino, grid, tetrominoPos)) {
      setTetromino(rotatedTetromino);
    }
  };

  const dropDistance = () => {
    let d = 0;
    while (!checkCollision(tetromino, grid, { x: tetrominoPos.x, y: tetrominoPos.y + d + 1 })) {
      d++;
    }
    return d;
  };

  const dropTetromino = () => {
    if (!checkCollision(tetromino, grid, { x: tetrominoPos.x, y: tetrominoPos.y + 1 })) {
      setTetrominoPos((prevPos) => ({ ...prevPos, y: prevPos.y + 1 }));
    } else {
      placeTetromino(tetrominoPos);
    }
  };

  const harddropTetromino = () => {
    placeTetromino({ x: tetrominoPos.x, y: tetrominoPos.y + dropDistance() });
  };

  // Take the first queued piece and refill the queue (without mutating state).
  const takeNextTetromino = () => {
    const [next, ...rest] = nextThreeTetrominos;
    setNextThreeTetrominos([...rest, randomTetromino()]);
    return next;
  };

  // Put `piece` at the top of `board`; game over if it doesn't fit.
  const spawnTetromino = (piece, board, finalScore) => {
    setTetromino(piece.shape);
    setColours(piece.color);
    const pos = startPos();
    if (checkCollision(piece.shape, board, pos)) {
      if (finalScore > highest) {
        localStorage.setItem('highscore', finalScore.toString());
      }
      setGameOver(true);
    } else {
      setTetrominoPos(pos);
    }
  };

  const placeTetromino = (pos) => {
    const newGrid = grid.map((row) => [...row]);
    let linesCleared = 0;

    // Store the piece's colour so locked blocks keep it.
    tetromino.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0 && pos.y + y >= 0) {
          newGrid[pos.y + y][pos.x + x] = colours;
        }
      });
    });

    for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
      if (newGrid[y].every((cell) => cell !== 0)) {
        newGrid.splice(y, 1);
        newGrid.unshift(Array(GRID_WIDTH).fill(0));
        y++;
        linesCleared++;
      }
    }

    setGrid(newGrid);

    const blockDropScore = tetromino.reduce((acc, row) => acc + row.filter((cell) => cell !== 0).length, 0);
    const newScore = score + linesCleared * 100 + blockDropScore;
    setScore(newScore);
    setLines((l) => l + linesCleared);

    // Any lock (gravity or hard drop) re-enables hold.
    setHasHeld(false);
    spawnTetromino(takeNextTetromino(), newGrid, newScore);
  };

  // Swap the current piece with the held one (or the next piece if nothing is
  // held). Allowed once per piece.
  const holdTetromino = () => {
    if (hasHeld) {
      return;
    }
    setHasHeld(true);
    const incoming = hold ? { shape: hold.tetromino, color: hold.colours } : takeNextTetromino();
    setHold({ tetromino, colours });
    spawnTetromino(incoming, grid, score);
  };

  const actions = {
    left: () => moveTetromino(-1, 0),
    right: () => moveTetromino(1, 0),
    down: () => moveTetromino(0, 1),
    rotate: rotateTetromino,
    drop: harddropTetromino,
    hold: holdTetromino,
  };
  const act = (name) => { if (!gameOver) actions[name](); };

  const EXERCISES = { 'Sway Left': 'left', 'Sway Right': 'right', Squat: 'drop', 'Jumping Jack': 'rotate', Flex: 'hold' };

  // Each detection is a fresh { exercise, seq } object, so repeats still fire.
  useEffect(() => {
    if (event && EXERCISES[event.exercise]) {
      act(EXERCISES[event.exercise]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useEffect(() => {
    const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate', ' ': 'drop', c: 'hold', C: 'hold' };
    const handleKeyDown = (e) => {
      const name = KEYS[e.key];
      if (!name || gameOver) return;
      e.preventDefault(); // no page scrolling, no re-clicking a focused button
      act(name);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const ghostY = gameOver ? null : tetrominoPos.y + dropDistance();

  return (
    <div className="layout">
      <h1 className="logo" aria-label="FITRIS">
        {LOGO.map(([ch, c], i) => <span key={i} style={{ color: c }}>{ch}</span>)}
      </h1>

      <aside className="side side-left">
        <section className="panel hold">
          <h2>HOLD</h2>
          <Preview shape={hold?.tetromino} color={hold?.colours} />
        </section>
        <section className="panel stats">
          <div><h2>SCORE</h2><p className="stat">{score}</p></div>
          <div><h2>LINES</h2><p className="stat">{lines}</p></div>
          <div><h2>HI</h2><p className="stat">{Math.max(highest, score)}</p></div>
        </section>
      </aside>

      <main className="panel board-panel">
        <div className="board">
          <GameGrid grid={grid} tetromino={tetromino} tetrominoPos={tetrominoPos} colours={colours} ghostY={ghostY} />
          {gameOver && (
            <div className="game-over-overlay">
              <p className="game-over">GAME<br />OVER</p>
              <p className="final">SCORE {score}</p>
              <button className="btn" onClick={resetGame} autoFocus>PLAY AGAIN</button>
            </div>
          )}
        </div>
      </main>

      <aside className="side side-right">
        <section className="panel next">
          <h2>NEXT</h2>
          <div className="next-list">
            {nextThreeTetrominos.map((t, i) => <Preview key={i} shape={t.shape} color={t.color} />)}
          </div>
        </section>
        {children}
      </aside>

      <div className="touch-controls" aria-label="Touch controls">
        <button className="btn pad" aria-label="Hold" onPointerDown={() => act('hold')}>HOLD</button>
        <button className="btn pad" aria-label="Rotate" onPointerDown={() => act('rotate')}>ROT</button>
        <button className="btn pad" aria-label="Hard drop" onPointerDown={() => act('drop')}>DROP</button>
        <button className="btn pad" aria-label="Move left" onPointerDown={() => act('left')}>&lt;</button>
        <button className="btn pad" aria-label="Soft drop" onPointerDown={() => act('down')}>v</button>
        <button className="btn pad" aria-label="Move right" onPointerDown={() => act('right')}>&gt;</button>
      </div>
    </div>
  );
};

export default Tetris;
