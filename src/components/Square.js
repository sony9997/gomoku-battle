import styles from './Square.module.css';

const Square = ({ value, onClick, xIsNext }) => {
    return (
        <div className={styles.square} onClick={onClick}>
            {value ? (
                <div className={`${styles.piece} ${value === 'Black' ? styles.black : styles.white}`} />
            ) : (
                <div className={`${styles.ghost} ${xIsNext ? styles.black : styles.white}`} />
            )}
        </div>
    );
};

export default Square;
