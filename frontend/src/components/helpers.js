// helpers.js

export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 15;

export const createEmptyGrid = (height = GRID_HEIGHT, width = GRID_WIDTH) => {
  return Array.from(Array(height), () => Array(width).fill(0));
};

export const checkCollision = (tetromino, grid, { x: moveX, y: moveY }) => {
  for (let y = 0; y < tetromino.length; y++) {
    for (let x = 0; x < tetromino[y].length; x++) {
      if (tetromino[y][x] !== 0) {
        const newX = x + moveX;
        const newY = y + moveY;

        // Check if the tetromino is within the grid boundaries
        if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
          return true;
        }

        // Check if the tetromino collides with existing blocks in the grid
        if (newY >= 0 && grid[newY][newX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
};

export const randomTetromino = () => {
  const tetrominoes = [
    { shape: [[1, 1, 1, 1]], color: '#00e5ff' },            // I
    { shape: [[1, 1, 1], [0, 1, 0]], color: '#b026ff' },  // T
    { shape: [[1, 1, 1], [1, 0, 0]], color: '#2f5bff' },    // J
    { shape: [[1, 1, 1], [0, 0, 1]], color: '#ff9f1a' },  // L
    { shape: [[1, 1], [1, 1]], color: '#ffe81a' },        // O
    { shape: [[0, 1, 1], [1, 1, 0]], color: '#2bff5e' },   // S
    { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff2b4a' },     // Z

];

const randomIndex = Math.floor(Math.random() * tetrominoes.length);
return tetrominoes[randomIndex];
};