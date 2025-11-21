const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces for LAN access
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            // Be sure to pass `true` as the second argument to `url.parse`.
            // This tells it to parse the query portion of the URL.
            const parsedUrl = parse(req.url, true);
            const { pathname, query } = parsedUrl;

            if (pathname === '/a') {
                await app.render(req, res, '/a', query);
            } else if (pathname === '/b') {
                await app.render(req, res, '/b', query);
            } else {
                await handle(req, res, parsedUrl);
            }
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(httpServer);

    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('createRoom', () => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms.set(roomId, {
                players: [socket.id],
                board: Array(225).fill(null),
                xIsNext: true
            });
            socket.join(roomId);
            socket.emit('roomCreated', { roomId, player: 'Black' }); // Creator is Black
            console.log(`Room created: ${roomId}`);
        });

        socket.on('joinRoom', (roomId) => {
            const room = rooms.get(roomId);
            if (room && room.players.length < 2) {
                room.players.push(socket.id);
                socket.join(roomId);
                socket.emit('roomJoined', { roomId, player: 'White' }); // Joiner is White
                io.to(roomId).emit('gameStart', { roomId });
                console.log(`Player joined room: ${roomId}`);
            } else {
                socket.emit('error', 'Room not found or full');
            }
        });

        socket.on('makeMove', ({ roomId, index, player }) => {
            const room = rooms.get(roomId);
            if (room) {
                // Verify it's the correct player's turn
                const isBlackTurn = room.xIsNext;
                const isBlackPlayer = player === 'Black';

                if (isBlackTurn === isBlackPlayer) {
                    room.board[index] = player;
                    room.xIsNext = !room.xIsNext;
                    io.to(roomId).emit('moveMade', { index, player, nextTurn: room.xIsNext ? 'Black' : 'White' });
                }
            }
        });

        socket.on('resetGame', (roomId) => {
            const room = rooms.get(roomId);
            if (room) {
                room.board = Array(225).fill(null);
                room.xIsNext = true;
                io.to(roomId).emit('gameReset');
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            // Cleanup logic could go here (remove player from room, notify other player)
            rooms.forEach((room, roomId) => {
                if (room.players.includes(socket.id)) {
                    io.to(roomId).emit('playerDisconnected');
                    rooms.delete(roomId);
                }
            });
        });
    });

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
