const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

let mainWindow;
let server;

const isDev = process.env.NODE_ENV !== 'production';
const port = 3000;

// Game rooms storage
const rooms = new Map();

async function createWindow() {
    // Start the Next.js server
    const nextApp = next({ dev: isDev, hostname: 'localhost', port });
    const handle = nextApp.getRequestHandler();

    await nextApp.prepare();

    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    // Socket.io for multiplayer
    const io = new Server(httpServer);

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
            socket.emit('roomCreated', { roomId, player: 'Black' });
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
            rooms.forEach((room, roomId) => {
                if (room.players.includes(socket.id)) {
                    io.to(roomId).emit('playerDisconnected');
                    rooms.delete(roomId);
                }
            });
        });
    });

    httpServer.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    server = httpServer;

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: '五子棋对战 (Gomoku Battle)',
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        // Remove menu bar for cleaner look
        autoHideMenuBar: true,
        // Center window
        center: true,
    });

    // Load the app
    await mainWindow.loadURL(`http://localhost:${port}`);

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Create application menu
    const menu = Menu.buildFromTemplate([
        {
            label: '游戏',
            submenu: [
                { label: '重新开始', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
                { type: 'separator' },
                { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
            ]
        },
        {
            label: '视图',
            submenu: [
                { label: '全屏', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
                { label: '开发者工具', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
            ]
        },
        {
            label: '帮助',
            submenu: [
                { label: '关于', click: () => {
                    const { dialog } = require('electron');
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: '关于五子棋对战',
                        message: '五子棋对战 (Gomoku Battle)',
                        detail: '版本: 1.0.0\n\n支持 PvP、PvE（AI对战）和局域网多人游戏模式。'
                    });
                }}
            ]
        }
    ]);

    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (server) {
        server.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle app quit
app.on('before-quit', () => {
    if (server) {
        server.close();
    }
});
