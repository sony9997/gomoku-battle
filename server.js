/**
 * server.js - HTTP + socket.io 服务器入口
 *
 * - 开发模式 (NODE_ENV != production): 使用标准 next 模块，支持热更新
 * - 生产模式 (NODE_ENV == production): 作为 standalone server 运行
 *   由 copy-standalone.js 复制到 .next/standalone/<project>/server.js
 *   electron.js 通过 fork 启动本文件
 */

'use strict';

const path = require('path');
const http = require('http');
const { parse } = require('url');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOSTNAME = process.env.HOSTNAME || (isDev ? '0.0.0.0' : 'localhost');

// ─────────────────────────────────────────────────────────────────────────────
// 游戏房间状态
// ─────────────────────────────────────────────────────────────────────────────
const rooms = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    let requestHandler;

    if (isDev) {
        // ── 开发模式：标准 next ──────────────────────────────────────────────
        const next = require('next');
        const nextApp = next({ dev: true, hostname: HOSTNAME, port: PORT });
        await nextApp.prepare();
        requestHandler = nextApp.getRequestHandler();
    } else {
        // ── 生产模式：standalone ─────────────────────────────────────────────
        // 本文件被复制到 standalone 目录后，__dirname 就是 standalone 项目根目录
        // 该目录下有 .next/ 和所有依赖 node_modules
        const dir = __dirname;
        process.chdir(dir);

        // 读取 Next.js standalone 配置（由 Next.js 在构建阶段注入）
        let standaloneConfig = {};
        try {
            standaloneConfig = JSON.parse(process.env.__NEXT_PRIVATE_STANDALONE_CONFIG || '{}');
        } catch (_) { }

        // 使用 next/dist 的 startServer（standalone 内置的启动方式）
        // 但我们需要拿到 requestHandler，所以用 NextServer
        const NextServer = require('next/dist/server/next-server').default;
        const nextServer = new NextServer({
            hostname: HOSTNAME,
            port: PORT,
            dir,
            customServer: true,
            conf: {
                ...standaloneConfig,
                distDir: '.next',
            },
        });
        requestHandler = nextServer.getRequestHandler();
        await nextServer.prepare();
    }

    // ── 创建 HTTP 服务器 ─────────────────────────────────────────────────────
    const httpServer = http.createServer(async (req, res) => {
        try {
            await requestHandler(req, res, parse(req.url, true));
        } catch (err) {
            console.error('[Server] Request error:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    // ── 挂载 socket.io ───────────────────────────────────────────────────────
    const { Server } = require('socket.io');
    const io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    io.on('connection', (socket) => {
        console.log('[Socket] Connected:', socket.id);

        socket.on('createRoom', () => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms.set(roomId, { players: [socket.id], board: Array(225).fill(null), xIsNext: true });
            socket.join(roomId);
            socket.emit('roomCreated', { roomId, player: 'Black' });
            console.log('[Socket] Room created:', roomId);
        });

        socket.on('joinRoom', (roomId) => {
            const room = rooms.get(roomId);
            if (room && room.players.length < 2) {
                room.players.push(socket.id);
                socket.join(roomId);
                socket.emit('roomJoined', { roomId, player: 'White' });
                io.to(roomId).emit('gameStart', { roomId });
            } else {
                socket.emit('error', 'Room not found or full');
            }
        });

        socket.on('makeMove', ({ roomId, index, player }) => {
            const room = rooms.get(roomId);
            if (room) {
                const isBlackTurn = room.xIsNext;
                const isBlackPlayer = player === 'Black';
                if (isBlackTurn === isBlackPlayer && room.board[index] === null) {
                    room.board[index] = player;
                    room.xIsNext = !room.xIsNext;
                    io.to(roomId).emit('moveMade', {
                        index, player,
                        nextTurn: room.xIsNext ? 'Black' : 'White'
                    });
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
            rooms.forEach((room, roomId) => {
                if (room.players.includes(socket.id)) {
                    io.to(roomId).emit('playerDisconnected');
                    rooms.delete(roomId);
                }
            });
        });
    });

    // ── 开始监听 ─────────────────────────────────────────────────────────────
    httpServer.listen(PORT, HOSTNAME, (err) => {
        if (err) { console.error('[Server] Listen error:', err); process.exit(1); }
        console.log(`> Ready on http://${HOSTNAME}:${PORT}`);
    });
}

main().catch((err) => {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
});
