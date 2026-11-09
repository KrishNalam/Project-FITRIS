// GameGrid.jsx
// A grid cell is 0 (empty) or the colour of the piece that locked there.
// The active piece is drawn on top; `ghostY` (optional) outlines where the
// active piece would land.

import React from 'react';

const pieceCell = (tetromino, pos, rowIndex, colIndex) =>
  Boolean(
    tetromino &&
    rowIndex >= pos.y &&
    rowIndex < pos.y + tetromino.length &&
    colIndex >= pos.x &&
    colIndex < pos.x + tetromino[0].length &&
    tetromino[rowIndex - pos.y][colIndex - pos.x] !== 0
  );

const GameGrid = ({ grid, tetromino, tetrominoPos, colours, ghostY, className = '' }) => {
  const ghostPos = ghostY != null && tetrominoPos ? { x: tetrominoPos.x, y: ghostY } : null;

  return (
    <div className={`game-grid ${className}`} style={{ gridTemplateColumns: `repeat(${grid[0].length}, var(--cell))` }}>
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const active = pieceCell(tetromino, tetrominoPos, rowIndex, colIndex);
          const ghost = !active && !cell && ghostPos && pieceCell(tetromino, ghostPos, rowIndex, colIndex);
          const colour = active ? colours : cell;
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`cell${colour ? ' occupied' : ''}${ghost ? ' ghost' : ''}`}
              style={{ backgroundColor: colour || 'transparent', '--c': ghost ? colours : undefined }}
            />
          );
        })
      )}
    </div>
  );
};

export default GameGrid;
