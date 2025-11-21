import { checkWinner } from './gameLogic';

const SIZE = 15;

const SCORES = {
    WIN: 100000,
    OPEN_4: 10000, // Live 4: XOOOOX (where X is empty)
    CLOSED_4: 1000, // Dead 4: OOOOX (blocked on one side)
    OPEN_3: 1000,
    CLOSED_3: 100,
    OPEN_2: 100,
    CLOSED_2: 10
};

const getLineInfo = (squares, idx, player, dx, dy) => {
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    let count = 1;
    let blockedStart = false;
    let blockedEnd = false;

    // Check forward
    let i = 1;
    while (true) {
        const r = row + dy * i;
        const c = col + dx * i;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
            blockedEnd = true;
            break;
        }
        if (squares[r * SIZE + c] === player) {
            count++;
        } else if (squares[r * SIZE + c] !== null) {
            blockedEnd = true;
            break;
        } else {
            break;
        }
        i++;
    }

    // Check backward
    i = 1;
    while (true) {
        const r = row - dy * i;
        const c = col - dx * i;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
            blockedStart = true;
            break;
        }
        if (squares[r * SIZE + c] === player) {
            count++;
        } else if (squares[r * SIZE + c] !== null) {
            blockedStart = true;
            break;
        } else {
            break;
        }
        i++;
    }

    return { count, blockedStart, blockedEnd };
};

const evaluateMove = (squares, idx, player) => {
    let score = 0;
    const directions = [
        [1, 0],   // Horizontal
        [0, 1],   // Vertical
        [1, 1],   // Diagonal \
        [1, -1],  // Diagonal /
    ];

    for (let [dx, dy] of directions) {
        const { count, blockedStart, blockedEnd } = getLineInfo(squares, idx, player, dx, dy);

        if (count >= 5) {
            score += SCORES.WIN;
        } else if (count === 4) {
            if (!blockedStart && !blockedEnd) score += SCORES.OPEN_4;
            else if (!blockedStart || !blockedEnd) score += SCORES.CLOSED_4;
        } else if (count === 3) {
            if (!blockedStart && !blockedEnd) score += SCORES.OPEN_3;
            else if (!blockedStart || !blockedEnd) score += SCORES.CLOSED_3;
        } else if (count === 2) {
            if (!blockedStart && !blockedEnd) score += SCORES.OPEN_2;
            else if (!blockedStart || !blockedEnd) score += SCORES.CLOSED_2;
        }
    }
    return score;
};

export const getBestMove = (squares, aiPlayer) => {
    const opponent = aiPlayer === 'Black' ? 'White' : 'Black';
    let bestScore = -Infinity;
    let bestMoves = [];

    // Optimization: If board is empty, play center
    if (squares.every(s => s === null)) {
        return 112; // Center of 15x15 (7,7) -> 7*15 + 7 = 112
    }

    for (let i = 0; i < squares.length; i++) {
        if (squares[i]) continue;

        // Evaluate offense
        const attackScore = evaluateMove(squares, i, aiPlayer);

        // Evaluate defense (how good is this spot for the opponent?)
        const defenseScore = evaluateMove(squares, i, opponent);

        // Weighted score
        // We want to prioritize winning, then blocking a win.
        // If we have a win, take it (attackScore >= WIN).
        // If opponent has a win, block it (defenseScore >= WIN).

        let currentScore = attackScore + defenseScore;

        // Boost blocking if opponent is about to win
        if (defenseScore >= SCORES.OPEN_4) {
            currentScore += SCORES.OPEN_4; // Prioritize blocking open 4s heavily
        }
        if (defenseScore >= SCORES.WIN) {
            currentScore += SCORES.WIN; // Must block immediate win
        }

        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestMoves = [i];
        } else if (currentScore === bestScore) {
            bestMoves.push(i);
        }
    }

    if (bestMoves.length === 0) return null;
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
};
