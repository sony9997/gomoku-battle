const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.join(__dirname, '..');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');
const STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORTABLE_DIR = path.join(DIST_DIR, 'gomoku-battle');

console.log('========================================');
console.log('  五子棋对战 Windows 打包工具');
console.log('========================================\n');

// Step 1: Check if build exists
if (!fs.existsSync(STANDALONE_DIR)) {
    console.log('📦 Building Next.js standalone...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

// Step 2: Create portable directory
console.log('\n📁 Creating portable package...');
if (fs.existsSync(PORTABLE_DIR)) {
    fs.rmSync(PORTABLE_DIR, { recursive: true });
}
fs.mkdirSync(PORTABLE_DIR, { recursive: true });

// Step 3: Copy standalone files
console.log('   Copying standalone files...');
copyDir(STANDALONE_DIR, PORTABLE_DIR);

// Step 4: Copy static files
console.log('   Copying static assets...');
const staticDest = path.join(PORTABLE_DIR, '.next', 'static');
fs.mkdirSync(staticDest, { recursive: true });
if (fs.existsSync(STATIC_DIR)) {
    copyDir(STATIC_DIR, staticDest);
}

// Step 5: Copy public files
console.log('   Copying public assets...');
if (fs.existsSync(PUBLIC_DIR)) {
    copyDir(PUBLIC_DIR, path.join(PORTABLE_DIR, 'public'));
}

// Step 6: Create Windows batch launcher
console.log('   Creating launcher...');
const batContent = `@echo off
title 五子棋对战 Gomoku Battle
color 0A
echo.
echo ========================================
echo        五子棋对战 (Gomoku Battle)
echo ========================================
echo.
echo [信息] 正在启动服务器...
echo [信息] 请在浏览器中访问: http://localhost:3000
echo [信息] 局域网访问: http://YOUR_IP:3000
echo.
echo [提示] 按 Ctrl+C 停止服务器
echo ========================================
echo.
cd /d "%~dp0"
set NODE_ENV=production
node server.js
if errorlevel 1 (
    echo.
    echo [错误] 启动失败！请确保已安装 Node.js 18+
    echo [下载] https://nodejs.org/
    pause
)
`;

fs.writeFileSync(path.join(PORTABLE_DIR, '启动服务器.bat'), batContent);

// Step 7: Create PowerShell launcher (for better user experience)
const ps1Content = `# 五子棋对战启动器
$Host.UI.RawUI.WindowTitle = "五子棋对战 Gomoku Battle"
Clear-Host

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       五子棋对战 (Gomoku Battle)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[信息] 正在启动服务器..." -ForegroundColor Green
Write-Host "[信息] 本机访问: " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "[信息] 局域网访问: " -NoNewline; Write-Host "http://<你的IP>:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot
$env:NODE_ENV = "production"
node server.js
`;

fs.writeFileSync(path.join(PORTABLE_DIR, '启动服务器.ps1'), ps1Content);

// Step 8: Create README
const readmeContent = `╔══════════════════════════════════════════════════════════════╗
║                  五子棋对战 (Gomoku Battle)                    ║
╚══════════════════════════════════════════════════════════════╝

【运行方法】
─────────────────────────────────────────────────────────────────
方法一（推荐）: 双击 "启动服务器.bat"
方法二: 右键 "启动服务器.ps1" → 使用 PowerShell 运行

启动后，在浏览器中访问:
  • 本机访问: http://localhost:3000
  • 局域网访问: http://<你的IP>:3000

【系统要求】
─────────────────────────────────────────────────────────────────
  • Windows 7 或更高版本
  • Node.js 18.0 或更高版本

如果没有安装 Node.js，请从以下地址下载:
  https://nodejs.org/zh-cn/
  (选择 LTS 版本下载安装)

【游戏说明】
─────────────────────────────────────────────────────────────────
  • PvP: 本地双人对战
  • PvE: 人机对战（AI 为白方）
  • LAN: 局域网多人对战
    - 一人创建房间，分享房间号给对方
    - 对方输入房间号加入

【3D 模式】
─────────────────────────────────────────────────────────────────
  • 点击 "3D" 按钮切换到 3D 视图
  • 支持鼠标拖拽旋转、滚轮缩放

【常见问题】
─────────────────────────────────────────────────────────────────
Q: 无法启动？
A: 请确保已安装 Node.js 18+，可在命令行运行 "node -v" 检查

Q: 局域网无法访问？
A: 请检查 Windows 防火墙是否允许 3000 端口

Q: 端口被占用？
A: 修改 server.js 中的 port 变量为其他端口

【技术支持】
─────────────────────────────────────────────────────────────────
GitHub: (项目地址)

祝游戏愉快！🎮
`;

fs.writeFileSync(path.join(PORTABLE_DIR, '使用说明.txt'), readmeContent, 'utf8');

// Step 9: Create VBS launcher (runs without command window)
const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c node server.js", 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:3000"
`;

fs.writeFileSync(path.join(PORTABLE_DIR, '启动游戏(无窗口).vbs'), vbsContent);

// Step 10: Create a simple launcher exe using pkg
console.log('\n🔨 Creating launcher executable...');

const launcherCode = `
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where exe is located
const exeDir = path.dirname(process.execPath);
const serverPath = path.join(exeDir, 'server.js');

console.log('\\x1b[36m========================================\\x1b[0m');
console.log('\\x1b[33m       五子棋对战 (Gomoku Battle)\\x1b[0m');
console.log('\\x1b[36m========================================\\x1b[0m');
console.log('');
console.log('\\x1b[32m[信息]\\x1b[0m 正在启动服务器...');
console.log('\\x1b[32m[信息]\\x1b[0m 本机访问: \\x1b[36mhttp://localhost:3000\\x1b[0m');
console.log('\\x1b[32m[信息]\\x1b[0m 局域网访问: \\x1b[36mhttp://<你的IP>:3000\\x1b[0m');
console.log('');
console.log('\\x1b[36m========================================\\x1b[0m');
console.log('');

// Set environment
process.env.NODE_ENV = 'production';

// Start the server
const server = spawn('node', [serverPath], {
    cwd: exeDir,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
});

server.on('error', (err) => {
    console.error('\\x1b[31m[错误]\\x1b[0m 启动失败:', err.message);
    console.log('\\x1b[33m[提示]\\x1b[0m 请确保已安装 Node.js 18+');
    process.exit(1);
});

server.on('exit', (code) => {
    process.exit(code || 0);
});
`;

const launcherFile = path.join(DIST_DIR, 'launcher.js');
fs.writeFileSync(launcherFile, launcherCode);

try {
    execSync(`npx pkg "${launcherFile}" --targets node18-win-x64 --output "${path.join(PORTABLE_DIR, '启动游戏.exe')}" --compress GZip`, {
        cwd: ROOT_DIR,
        stdio: 'pipe'
    });
    console.log('   ✅ Launcher exe created');
} catch (e) {
    console.log('   ⚠️  Launcher exe creation skipped (pkg error)');
    console.log('   ℹ️  Users can use 启动服务器.bat instead');
}

// Cleanup
if (fs.existsSync(launcherFile)) {
    fs.unlinkSync(launcherFile);
}

// Summary
console.log('\n========================================');
console.log('  ✅ 打包完成！');
console.log('========================================\n');
console.log(`📁 输出目录: ${PORTABLE_DIR}`);
console.log('\n📋 包含文件:');
console.log('   ├── 启动服务器.bat      (推荐使用)');
console.log('   ├── 启动服务器.ps1      (PowerShell)');
console.log('   ├── 启动游戏(无窗口).vbs (后台运行)');
console.log('   ├── 使用说明.txt');
console.log('   └── ... (应用文件)');
console.log('\n📤 分发方式:');
console.log('   将整个 gomoku-battle 文件夹压缩成 ZIP 发给朋友');
console.log('   解压后双击 启动服务器.bat 即可运行');
console.log('\n⚠️  注意: 用户需要安装 Node.js 18+');
console.log('');

// Helper function
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
