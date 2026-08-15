// GameGrid.js
// A grid cell is 0 (empty) or the colour of the piece that locked there.

import React from 'react';

const GameGrid = ({ grid, tetromino, tetrominoPos, colours }) => {
  const isTetrominoCell = (rowIndex, colIndex) =>
    Boolean(
      tetromino &&
      rowIndex >= tetrominoPos.y &&
      rowIndex < tetrominoPos.y + tetromino.length &&
      colIndex >= tetrominoPos.x &&
      colIndex < tetrominoPos.x + tetromino[0].length &&
      tetromino[rowIndex - tetrominoPos.y][colIndex - tetrominoPos.x] !== 0
    );

  return (
    <div className="game-grid">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const active = isTetrominoCell(rowIndex, colIndex);
          const colour = active ? colours : cell || 'transparent';
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`cell ${active || cell ? 'occupied' : ''}`}
              style={{ backgroundColor: colour }}
            />
          );
        })
      )}
    </div>
  );
};

export default GameGrid;
