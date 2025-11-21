import Square from './Square';
import styles from './Board.module.css';

const Board = ({ squares, onClick, xIsNext }) => {
    return (
        <div className={styles.board}>
            {squares.map((square, i) => (
                <Square key={i} value={square} onClick={() => onClick(i)} xIsNext={xIsNext} />
            ))}
        </div>
    );
};

export default Board;
