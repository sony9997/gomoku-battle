'use client';

import { useState, useEffect, useRef } from 'react';
import Board from '../components/Board';
import Board3D from '../components/Board3D';
import { checkWinner } from '../utils/gameLogic';
import { getBestMove } from '../utils/aiLogic';
import styles from './page.module.css';
import io from 'socket.io-client';

let socket;

export default function Home() {
    const [squares, setSquares] = useState(Array(225).fill(null));
    const [xIsNext, setXIsNext] = useState(true);
    const [winner, setWinner] = useState(null);
    const [gameMode, setGameMode] = useState('PvP'); // 'PvP', 'PvE', 'LAN'
    const [viewMode, setViewMode] = useState('2D'); // '2D' or '3D'

    // LAN State
    const [roomId, setRoomId] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [playerColor, setPlayerColor] = useState(null); // 'Black' or 'White'
    const [isConnected, setIsConnected] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);

    const aiPlayer = 'White'; // AI plays White (Second)

    useEffect(() => {
        if (gameMode === 'LAN') {
            socketInitializer();
        } else {
            if (socket) {
                socket.disconnect();
                socket = null;
                setIsConnected(false);
                setGameStarted(false);
                setRoomId('');
                setPlayerColor(null);
            }
        }
    }, [gameMode]);

    const socketInitializer = async () => {
        socket = io();

        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
        });

        socket.on('roomCreated', ({ roomId, player }) => {
            setRoomId(roomId);
            setPlayerColor(player);
            console.log('Room created:', roomId);
        });

        socket.on('roomJoined', ({ roomId, player }) => {
            setRoomId(roomId);
            setPlayerColor(player);
            console.log('Joined room:', roomId);
        });

        socket.on('gameStart', () => {
            setGameStarted(true);
            setSquares(Array(225).fill(null));
            setXIsNext(true);
            setWinner(null);
            alert('Game Started!');
        });

        socket.on('moveMade', ({ index, player, nextTurn }) => {
            setSquares(prev => {
                const next = [...prev];
                next[index] = player;
                return next;
            });
            setXIsNext(nextTurn === 'Black');
        });

        socket.on('gameReset', () => {
            setSquares(Array(225).fill(null));
            setXIsNext(true);
            setWinner(null);
        });

        socket.on('playerDisconnected', () => {
            alert('Opponent disconnected');
            setGameStarted(false);
            setWinner(null);
            setRoomId('');
            setPlayerColor(null);
            setGameMode('PvP'); // Fallback
        });
    };

    // Check winner locally whenever squares update
    useEffect(() => {
        // Simple check for winner on every update if we don't have the last move index easily available
        // We can iterate to find the last move or just check all filled squares (inefficient but works for 15x15)
        // A better way is to rely on the fact that checkWinner needs the last move index.
        // We can find the last move by comparing with previous state, but we don't have it here easily.
        // Let's just iterate through all non-null squares to check for a winner? No, that's O(N*4*5).
        // 225 * 20 operations is fine.

        if (!winner) {
            for (let i = 0; i < 225; i++) {
                if (squares[i]) {
                    const win = checkWinner(squares, i);
                    if (win) {
                        setWinner(win);
                        return;
                    }
                }
            }
        }
    }, [squares, winner]);


    const makeMove = (i) => {
        const nextSquares = squares.slice();
        nextSquares[i] = xIsNext ? 'Black' : 'White';
        setSquares(nextSquares);
        setXIsNext(!xIsNext);

        const win = checkWinner(nextSquares, i);
        if (win) {
            setWinner(win);
        }
    };

    const handleClick = (i) => {
        if (winner || squares[i]) return;

        if (gameMode === 'LAN') {
            if (!gameStarted) return;
            if ((xIsNext && playerColor !== 'Black') || (!xIsNext && playerColor !== 'White')) {
                return; // Not your turn
            }
            socket.emit('makeMove', { roomId, index: i, player: playerColor });
            return;
        }

        // If PvE, prevent user from playing during AI turn
        const isAiTurn = gameMode === 'PvE' && !xIsNext; // AI is White (false)
        if (isAiTurn) return;

        makeMove(i);
    };

    // AI Turn Effect
    useEffect(() => {
        if (gameMode === 'PvE' && !winner && !xIsNext) {
            // AI's turn (White)
            const timer = setTimeout(() => {
                const bestMove = getBestMove(squares, aiPlayer);
                if (bestMove !== null) {
                    makeMove(bestMove);
                }
            }, 500); // 500ms delay for better UX
            return () => clearTimeout(timer);
        }
    }, [squares, xIsNext, winner, gameMode]);

    const resetGame = () => {
        if (gameMode === 'LAN') {
            socket.emit('resetGame', roomId);
        } else {
            setSquares(Array(225).fill(null));
            setXIsNext(true);
            setWinner(null);
        }
    };

    const toggleMode = (mode) => {
        setGameMode(mode);
        // Reset local game state
        setSquares(Array(225).fill(null));
        setXIsNext(true);
        setWinner(null);
    };

    const createRoom = () => {
        socket.emit('createRoom');
    };

    const joinRoom = () => {
        if (joinRoomId) {
            socket.emit('joinRoom', joinRoomId);
        }
    };

    let status;
    if (winner) {
        status = `Winner: ${winner}`;
    } else {
        status = `Next player: ${xIsNext ? 'Black' : 'White'}`;
        if (gameMode === 'PvE' && !xIsNext) {
            status += ' (AI)';
        }
        if (gameMode === 'LAN') {
            if (!gameStarted) {
                status = 'Waiting for opponent...';
            } else {
                status += ` (You are ${playerColor})`;
            }
        }
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Gomoku Battle</h1>

            <div className={styles.controlsTop}>
                <div className={styles.modeSelector}>
                    <button
                        className={`${styles.button} ${gameMode === 'PvP' ? styles.active : ''}`}
                        onClick={() => toggleMode('PvP')}
                    >
                        PvP
                    </button>
                    <button
                        className={`${styles.button} ${gameMode === 'PvE' ? styles.active : ''}`}
                        onClick={() => toggleMode('PvE')}
                    >
                        PvE (vs AI)
                    </button>
                    <button
                        className={`${styles.button} ${gameMode === 'LAN' ? styles.active : ''}`}
                        onClick={() => toggleMode('LAN')}
                    >
                        LAN
                    </button>
                </div>

                <div className={styles.viewSelector}>
                    <button
                        className={`${styles.button} ${viewMode === '2D' ? styles.active : ''}`}
                        onClick={() => setViewMode('2D')}
                    >
                        2D
                    </button>
                    <button
                        className={`${styles.button} ${viewMode === '3D' ? styles.active : ''}`}
                        onClick={() => setViewMode('3D')}
                    >
                        3D
                    </button>
                </div>
            </div>

            {gameMode === 'LAN' && !gameStarted && (
                <div className={styles.lanControls}>
                    {!roomId ? (
                        <>
                            <button className={styles.button} onClick={createRoom}>Create Room</button>
                            <div className={styles.joinContainer}>
                                <input
                                    type="text"
                                    placeholder="Room ID"
                                    value={joinRoomId}
                                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                                    className={styles.input}
                                />
                                <button className={styles.button} onClick={joinRoom}>Join</button>
                            </div>
                        </>
                    ) : (
                        <div className={styles.roomInfo}>
                            <p>Room ID: <strong>{roomId}</strong></p>
                            <p>Share this ID with your friend</p>
                        </div>
                    )}
                </div>
            )}

            <div className={`${styles.status} ${winner ? styles.winner : ''}`}>
                {status}
            </div>

            <div className={styles.boardContainer}>
                {viewMode === '2D' ? (
                    <Board squares={squares} onClick={handleClick} xIsNext={xIsNext} />
                ) : (
                    <Board3D squares={squares} onClick={handleClick} xIsNext={xIsNext} />
                )}
            </div>

            <div className={styles.controls}>
                <button className={styles.button} onClick={resetGame}>
                    Reset Game
                </button>
            </div>
        </div>
    );
}
