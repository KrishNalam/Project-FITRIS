import { render, fireEvent, act } from '@testing-library/react';
import Tetris from './Tetris';

const mainGridColours = (container) =>
  [...container.querySelectorAll('.tetris .cell')]
    .map((c) => c.style.backgroundColor)
    .filter((c) => c && c !== 'transparent');

const holdGridColours = (container) =>
  [...container.querySelectorAll('.hold .cell')]
    .map((c) => c.style.backgroundColor)
    .filter((c) => c && c !== 'transparent');

// Deterministic pieces: I, T, J, L, O, S, Z, I, ... so consecutive pieces differ.
let n;
beforeEach(() => {
  localStorage.clear();
  n = 0;
  jest.spyOn(Math, 'random').mockImplementation(() => (n++ % 7) / 7 + 0.01);
});
afterEach(() => jest.restoreAllMocks());

test('locked pieces keep their colour', () => {
  const { container } = render(<Tetris event={null} />);
  expect(mainGridColours(container)).toHaveLength(4); // the falling piece
  fireEvent.keyDown(document, { key: ' ' });           // hard drop
  // 4 locked cells + 4 for the new falling piece, all coloured.
  expect(mainGridColours(container)).toHaveLength(8);
});

test('hold works again after a piece locks by gravity', () => {
  jest.useFakeTimers();
  const { container } = render(<Tetris event={null} />);
  fireEvent.keyDown(document, { key: 'c' });
  expect(holdGridColours(container)).toHaveLength(4);
  const firstHold = holdGridColours(container).join();

  // Let gravity lock the current piece (grid is 15 rows, 500 ms per row).
  for (let i = 0; i < 20; i++) act(() => { jest.advanceTimersByTime(500); });

  fireEvent.keyDown(document, { key: 'c' });            // swap with the held piece
  expect(holdGridColours(container)).toHaveLength(4);
  // The held piece changed (cyan I -> blue J), so the second hold was accepted.
  expect(holdGridColours(container).join()).not.toBe(firstHold);
  jest.useRealTimers();
});

test('exercise events drive the game', () => {
  const { container, rerender } = render(<Tetris event={null} />);
  rerender(<Tetris event={{ exercise: 'Squat', seq: 1 }} />);
  expect(mainGridColours(container)).toHaveLength(8);
});
