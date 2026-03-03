import Square from './Square';
import styles from './Board.module.css';

const BOARD_SIZE = 15;

// Star point positions (天元和星位)
const STAR_POINTS = [
    [3, 3], [3, 7], [3, 11],
    [7, 3], [7, 7], [7, 11],
    [11, 3], [11, 7], [11, 11]
];

const Board = ({ squares, onClick, xIsNext }) => {
    const getPosition = (row, col) => ({
        left: `calc(19px + ${col} * 38px)`,
        top: `calc(19px + ${row} * 38px)`
    });

    return (
        <div className={styles.board}>
            {/* Star points */}
            {STAR_POINTS.map(([row, col], i) => (
                <div
                    key={`star-${i}`}
                    className={styles.starPoint}
                    style={getPosition(row, col)}
                />
            ))}

            {/* Clickable squares with pieces */}
            {squares.map((square, i) => {
                const row = Math.floor(i / BOARD_SIZE);
                const col = i % BOARD_SIZE;

                return (
                    <Square
                        key={i}
                        value={square}
                        onClick={() => onClick(i)}
                        xIsNext={xIsNext}
                        style={getPosition(row, col)}
                    />
                );
            })}
        </div>
    );
};

export default Board;
