const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const { Server } = require('socket.io');

let mainWindow;
let server;
let httpServer;

const port = 3000;
const isDev = !app.isPackaged;

// 游戏房间存储
const rooms = new Map();

// 获取应用路径
function getAppPath() {
    if (isDev) {
        return __dirname;
    }
    // 打包后，文件在 resources/app 目录
    return path.join(process.resourcesPath, 'app');
}

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (dialog) {
        dialog.showErrorBox('错误', error.message);
    }
});

async function createWindow() {
    try {
        const appPath = getAppPath();
        console.log('App Path:', appPath);
        console.log('Is Dev:', isDev);

        // 设置环境变量
        process.env.NODE_ENV = 'production';

        // 动态加载 Next.js 和相关模块
        const nextPath = path.join(appPath, 'node_modules', 'next');
        const socketPath = path.join(appPath, 'node_modules', 'socket.io');

        console.log('Next.js path:', nextPath);
        console.log('Socket.io path:', socketPath);

        const next = require(nextPath);
        const { Server } = require(socketPath);

        // 创建 Next.js 应用
        const nextApp = next({
            dev: false,
            hostname: 'localhost',
            port: port,
            dir: appPath,
            conf: {
                distDir: '.next',
            }
        });

        const handle = nextApp.getRequestHandler();

        console.log('Preparing Next.js...');
        await nextApp.prepare();
        console.log('Next.js prepared');

        // 创建 HTTP 服务器
        httpServer = createServer(async (req, res) => {
            try {
                const parsedUrl = parse(req.url, true);
                await handle(req, res, parsedUrl);
            } catch (err) {
                console.error('Request Error:', err);
                res.statusCode = 500;
                res.end('Internal Server Error');
            }
        });

        // Socket.io
        const io = new Server(httpServer, {
            cors: { origin: '*', methods: ['GET', 'POST'] }
        });

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
                    if (isBlackTurn === isBlackPlayer && room.board[index] === null) {
                        room.board[index] = player;
                        room.xIsNext = !room.xIsNext;
                        io.to(roomId).emit('moveMade', {
                            index,
                            player,
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

        // 启动服务器
        await new Promise((resolve, reject) => {
            httpServer.listen(port, 'localhost', (err) => {
                if (err) reject(err);
                else {
                    console.log(`Server running on http://localhost:${port}`);
                    resolve();
                }
            });
        });

        server = httpServer;

        // 创建窗口
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            title: '五子棋对战',
            icon: path.join(appPath, 'public', 'icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
            autoHideMenuBar: true,
            center: true,
            show: false,
        });

        await mainWindow.loadURL(`http://localhost:${port}`);
        mainWindow.show();

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        // 菜单
        const menu = Menu.buildFromTemplate([
            {
                label: '游戏',
                submenu: [
                    { label: '重新开始', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
                    { type: 'separator' },
                    { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() }
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
                    {
                        label: '关于',
                        click: () => {
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: '关于',
                                message: '五子棋对战',
                                detail: '版本: 1.0.0\n\n支持 PvP、PvE 和局域网多人游戏。'
                            });
                        }
                    }
                ]
            }
        ]);
        Menu.setApplicationMenu(menu);

        mainWindow.on('closed', () => {
            mainWindow = null;
        });

    } catch (error) {
        console.error('Startup error:', error);
        dialog.showErrorBox('启动失败', `无法启动应用程序:\n\n${error.message}`);
        app.quit();
    }
}

// 应用生命周期
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (server) server.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (server) server.close();
});
