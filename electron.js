/**
 * electron.js - Electron 主进程
 *
 * 启动流程：
 *   1. 读取 .next/standalone-path.json 获取 standalone server.js 路径
 *   2. fork 该 server.js（已集成 socket.io）
 *   3. 等待端口就绪后打开窗口
 */

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');
const fs = require('fs');

let mainWindow;
let serverProcess;

const PORT = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// 未捕获异常保底
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
    console.error('[Electron] Uncaught Exception:', error);
    try { dialog.showErrorBox('错误', error.message); } catch (_) { }
});

// ─────────────────────────────────────────────────────────────────────────────
// 等待指定端口可连接
// ─────────────────────────────────────────────────────────────────────────────
function waitForPort(port, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        function attempt() {
            const sock = new net.Socket();
            sock.setTimeout(500);
            const cleanup = () => { try { sock.destroy(); } catch (_) { } };
            sock.once('connect', () => { cleanup(); resolve(); });
            sock.once('error', () => { cleanup(); retry(); });
            sock.once('timeout', () => { cleanup(); retry(); });
            sock.connect(port, 'localhost');
        }
        function retry() {
            if (Date.now() >= deadline) {
                reject(new Error(`端口 ${port} 在 ${timeoutMs}ms 内未就绪`));
            } else {
                setTimeout(attempt, 500);
            }
        }
        attempt();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 找到 standalone server.js 路径
// ─────────────────────────────────────────────────────────────────────────────
function resolveServerScript() {
    // __dirname 在打包后指向 app 资源根目录
    const standalonePathJson = path.join(__dirname, '.next', 'standalone-path.json');

    if (fs.existsSync(standalonePathJson)) {
        const { projectRelPath } = JSON.parse(fs.readFileSync(standalonePathJson, 'utf-8'));
        const serverPath = path.join(__dirname, '.next', 'standalone', projectRelPath, 'server.js');
        if (fs.existsSync(serverPath)) return serverPath;
    }

    // fallback：搜索 standalone 目录找 server.js
    const standaloneDir = path.join(__dirname, '.next', 'standalone');
    if (fs.existsSync(standaloneDir)) {
        const found = findServerJs(standaloneDir, 0);
        if (found) return found;
    }

    // 最后 fallback：开发模式下直接用根目录的 server.js
    const devServer = path.join(__dirname, 'server.js');
    if (fs.existsSync(devServer)) return devServer;

    throw new Error('找不到 server.js，请先执行 npm run electron:build');
}

function findServerJs(dir, depth) {
    if (depth > 15) return null;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return null; }
    const hasServer = entries.some(e => e.isFile() && e.name === 'server.js');
    const hasPkg = entries.some(e => e.isFile() && e.name === 'package.json');
    if (hasServer && hasPkg) return path.join(dir, 'server.js');
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const found = findServerJs(path.join(dir, entry.name), depth + 1);
            if (found) return found;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 启动 Next.js + socket.io 服务（子进程）
// ─────────────────────────────────────────────────────────────────────────────
function startServer() {
    const serverScript = resolveServerScript();
    const serverDir = path.dirname(serverScript);
    console.log('[Electron] Starting server:', serverScript);

    return new Promise((resolve, reject) => {
        serverProcess = fork(serverScript, [], {
            cwd: serverDir,           // 必须在 standalone 项目目录下运行
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: String(PORT),
                HOSTNAME: 'localhost',
            },
            silent: true,             // 捕获子进程输出
        });

        serverProcess.stdout && serverProcess.stdout.on('data', d => {
            process.stdout.write('[Server] ' + d);
        });
        serverProcess.stderr && serverProcess.stderr.on('data', d => {
            process.stderr.write('[Server] ' + d);
        });
        serverProcess.on('error', reject);
        serverProcess.on('exit', code => {
            if (code !== 0) console.error('[Server] exited with code:', code);
        });

        waitForPort(PORT).then(resolve).catch(reject);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 创建主窗口
// ─────────────────────────────────────────────────────────────────────────────
async function createWindow() {
    try {
        await startServer();
        console.log('[Electron] Server ready on port', PORT);

        mainWindow = new BrowserWindow({
            width: 1200,
            height: 900,
            minWidth: 800,
            minHeight: 600,
            title: '五子棋对战',
            icon: path.join(__dirname, 'public', 'icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
            autoHideMenuBar: true,
            center: true,
            show: false,
        });

        await mainWindow.loadURL(`http://localhost:${PORT}`);
        mainWindow.show();

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

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
                submenu: [{
                    label: '关于',
                    click: () => dialog.showMessageBox(mainWindow, {
                        type: 'info', title: '关于', message: '五子棋对战',
                        detail: '版本: 1.0.0\n\n支持 PvP、PvE 和局域网多人游戏。'
                    })
                }]
            }
        ]);
        Menu.setApplicationMenu(menu);

        mainWindow.on('closed', () => { mainWindow = null; });

    } catch (error) {
        console.error('[Electron] Startup error:', error);
        dialog.showErrorBox(
            '启动失败',
            `无法启动应用程序:\n\n${error.message}\n\n${error.stack || ''}`
        );
        app.quit();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// App 生命周期
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

function killServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

app.on('window-all-closed', () => {
    killServer();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killServer);
