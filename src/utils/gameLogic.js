export const checkWinner = (squares, lastMoveIdx) => {
  if (lastMoveIdx === null || !squares[lastMoveIdx]) return null;

  const size = 15;
  const player = squares[lastMoveIdx];
  const row = Math.floor(lastMoveIdx / size);
  const col = lastMoveIdx % size;

  const directions = [
    [1, 0],   // Horizontal
    [0, 1],   // Vertical
    [1, 1],   // Diagonal \
    [1, -1],  // Diagonal /
  ];

  for (let [dx, dy] of directions) {
    let count = 1;

    // Check forward
    for (let i = 1; i < 5; i++) {
      const r = row + dy * i;
      const c = col + dx * i;
      if (
        r >= 0 && r < size &&
        c >= 0 && c < size &&
        squares[r * size + c] === player
      ) {
        count++;
      } else {
        break;
      }
    }

    // Check backward
    for (let i = 1; i < 5; i++) {
      const r = row - dy * i;
      const c = col - dx * i;
      if (
        r >= 0 && r < size &&
        c >= 0 && c < size &&
        squares[r * size + c] === player
      ) {
        count++;
      } else {
        break;
      }
    }

    if (count >= 5) {
      return player;
    }
  }

  return null;
};
