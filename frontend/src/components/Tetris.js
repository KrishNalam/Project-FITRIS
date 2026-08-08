import React, { useState, useEffect } from 'react';
import { createEmptyGrid, checkCollision, GRID_WIDTH, GRID_HEIGHT, randomTetromino } from './helpers';
import GameGrid from './GameGrid';
import './Tetris.css'; // Import Tetris-specific CSS

const startPos = () => ({ x: Math.floor(GRID_WIDTH / 2) - 1, y: 0 });

const Tetris = ({event}) => {
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

  const storedHighScore = localStorage.getItem('highscore');
  const highest = storedHighScore ? parseInt(storedHighScore, 10) : 0;

  useEffect(() => {
    const dropInterval = setInterval(() => {
      if(!gameOver){
        dropTetromino();
      }
    }, 500);
    return () => clearInterval(dropInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [tetrominoPos, tetromino, grid, colours, gameOver]);

  const moveTetromino = (dx, dy) => {
    if (!checkCollision(tetromino, grid, { x: tetrominoPos.x + dx, y: tetrominoPos.y + dy })) {
      setTetrominoPos((prevPos) => ({
        x: prevPos.x + dx,
        y: prevPos.y + dy,
      }));
    }
  };

  const rotateTetromino = () => {
    const rotate = (matrix) => {
      // Transpose the matrix
      const transposed = matrix[0].map((_, i) => matrix.map(row => row[i]));
      // Reverse the rows to get the rotated matrix
      return transposed.map(row => row.reverse());
    };

    const rotatedTetromino = rotate(tetromino);

    // Check for collision with rotated tetromino
    if (!checkCollision(rotatedTetromino, grid, tetrominoPos)) {
      setTetromino(rotatedTetromino);
    }
  };

  const dropTetromino = () => {
    if (!checkCollision(tetromino, grid, { x: tetrominoPos.x, y: tetrominoPos.y + 1 })) {
      setTetrominoPos((prevPos) => ({
        ...prevPos,
        y: prevPos.y + 1,
      }));
    } else {
      // Lock the Tetromino in place and spawn a new one
      placeTetromino(tetrominoPos);
    }
  };

  const harddropTetromino = () => {
    let dropDistance = 0;
    while (!checkCollision(tetromino, grid, { x: tetrominoPos.x, y: tetrominoPos.y + dropDistance + 1 })) {
      dropDistance++;
    }
    placeTetromino({ x: tetrominoPos.x, y: tetrominoPos.y + dropDistance });
  };

  // Take the first queued piece and refill the queue (without mutating state).
  const takeNextTetromino = () => {
    const [next, ...rest] = nextThreeTetrominos;
    setNextThreeTetrominos([...rest, randomTetromino()]);
    return next;
  };

  // Put `piece` at the top of `board`. The game-over check uses the piece being
  // spawned and the board after the last lock; it used to read the previous
  // piece and the pre-lock grid from stale state.
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

  const placeTetromino = (tetrominoPos) => {
    const newGrid = grid.map((row) => [...row]);
    let linesCleared = 0;

    // Store the piece's colour so locked blocks keep it.
    tetromino.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell !== 0) {
          if (tetrominoPos.y + y >= 0) {
            newGrid[tetrominoPos.y + y][tetrominoPos.x + x] = colours;
          }
        }
      });
    });

    // Check for line clears
    for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
      if (newGrid[y].every((cell) => cell !== 0)) {
        // Clear the line and shift the grid down
        newGrid.splice(y, 1);
        newGrid.unshift(Array(GRID_WIDTH).fill(0));
        y++;
        linesCleared++;
      }
    }

    setGrid(newGrid);

    const blockDropScore = tetromino.reduce((acc, row) => acc + row.filter(cell => cell !== 0).length, 0);
    const newScore = score + (linesCleared * 100) + blockDropScore;
    setScore(newScore);

    // Any lock (gravity or hard drop) re-enables hold; before, only a hard drop did.
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

    const incoming = hold
      ? { shape: hold.tetromino, color: hold.colours }
      : takeNextTetromino();
    setHold({ tetromino, colours });
    spawnTetromino(incoming, grid, score);
  };

  // Maps a detected exercise to a game action.
  const applyExercise = (exercise) => {
    if (gameOver) {
      return;
    }
    switch (exercise) {
      case 'Sway Left':
        moveTetromino(-1, 0);
        break;
      case 'Sway Right':
        moveTetromino(1, 0);
        break;
      case 'Squat':
        harddropTetromino();
        break;
      case 'Jumping Jack':
        rotateTetromino();
        break;
      case 'Flex':
        holdTetromino();
        break;
      default:
        break;
    }
  };

  // Respond to exercise detections streamed from the backend. Each detection
  // carries a unique, incrementing `seq`, so even two identical exercises in a
  // row arrive as distinct events and each triggers an action.
  useEffect(() => {
    if (event && event.exercise) {
      applyExercise(event.exercise);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // Keyboard controls (useful for playing/testing without a webcam).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver) {
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault(); // stop the page from scrolling while playing
      }
      switch (e.key) {
        case 'ArrowLeft':
          moveTetromino(-1, 0);
          break;
        case 'ArrowRight':
          moveTetromino(1, 0);
          break;
        case 'ArrowDown':
          moveTetromino(0, 1);
          break;
        case 'ArrowUp':
          rotateTetromino();
          break;
        case ' ':
          harddropTetromino();
          break;
        case 'c':
        case 'C':
          holdTetromino();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });



  return (
    <div className='whole'>
      <div className='leftline'>
      <div className='tetrisTwo'>
        <div className='uppt2'>
          <h2>HOLDS</h2>
          <div className='hold'>
            {hold ? (<GameGrid grid={createEmptyGrid(5, 10)} tetromino={hold.tetromino} tetrominoPos={{ x: 2, y: 1}} colours={hold.colours} />) : (<GameGrid grid={createEmptyGrid(5, 10)} />)}
        </div>
      </div>
      </div>
      <div className='tetrisTwo'>
        <div className='uppt2'>
          <h2>SCORE</h2>
          <div className="score">{score}</div>
          <h2>HIGH SCORE</h2>
          <div className="score">{highest}</div>
      </div>
      </div>
      </div>
    <div className="tetris">
      <div className='up'>
        <h1>FITRIS</h1>
        <GameGrid grid={grid} tetromino={tetromino} tetrominoPos={tetrominoPos} colours={colours} />
        {gameOver && (
          <div className="game-over-overlay">
            <div className="game-over">
              Game Over
            </div>
            <button className="play" onClick={() => window.location.reload()}>Play Again</button>
          </div>
        )}
      </div>
    </div>
    <div className='tetrisThree'>
        <div className='uppt2'>
          <h2>NEXT</h2>
          <div className='next-tetrominos'>
            {nextThreeTetrominos.map((nextTetromino, index) => (
              nextTetromino && (
              <div key={index}>
                <GameGrid
                  grid={createEmptyGrid(4, 10)}
                  tetromino={nextTetromino.shape}
                  tetrominoPos={{ x: 2, y: 1 }}
                  colours={nextTetromino.color}
                />
              </div>
              )
            ))}     
          </div>   
        </div>
      </div>
    
    </div>
  );
};

export default Tetris;
