/**
 * 创建完整的便携版 EXE
 * 预打包 Node.js 运行时，用户无需安装任何依赖
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');
const STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const NODE_VERSION = '18.20.5';
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;

console.log('========================================');
console.log('  五子棋对战 - 完整便携版生成器');
console.log('========================================\n');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`   下载: ${url}`);

        const request = (urlStr) => {
            https.get(urlStr, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    request(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloaded = 0;

                const file = fs.createWriteStream(dest);
                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    const percent = Math.round((downloaded / totalSize) * 100);
                    process.stdout.write(`\r   进度: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
                });
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log('\n   ✅ 下载完成');
                    resolve();
                });
            }).on('error', reject);
        };

        request(url);
    });
}

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

function findStandaloneAppDir() {
    // Next.js standalone creates a nested directory structure
    // Find the actual app directory that contains server.js
    function searchDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subDir = path.join(dir, entry.name);
                const serverJs = path.join(subDir, 'server.js');
                if (fs.existsSync(serverJs)) {
                    return subDir;
                }
                const found = searchDir(subDir);
                if (found) return found;
            }
        }
        return null;
    }

    const directServerJs = path.join(STANDALONE_DIR, 'server.js');
    if (fs.existsSync(directServerJs)) {
        return STANDALONE_DIR;
    }

    return searchDir(STANDALONE_DIR) || STANDALONE_DIR;
}

async function main() {
    // Step 1: Build Next.js if needed
    if (!fs.existsSync(STANDALONE_DIR)) {
        console.log('📦 Building Next.js standalone...');
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    }

    // Find the actual app directory in standalone
    const appDir = findStandaloneAppDir();
    console.log(`\n📁 应用目录: ${appDir}`);

    // Step 2: Create output directory
    const outputDir = path.join(DIST_DIR, 'gomoku-battle-full');
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // Step 3: Copy application files from correct location
    console.log('\n📁 复制应用文件...');
    copyDir(appDir, outputDir);

    // Copy static files
    const staticDest = path.join(outputDir, '.next', 'static');
    fs.mkdirSync(staticDest, { recursive: true });
    if (fs.existsSync(STATIC_DIR)) {
        copyDir(STATIC_DIR, staticDest);
    }

    // Copy public files
    if (fs.existsSync(PUBLIC_DIR)) {
        copyDir(PUBLIC_DIR, path.join(outputDir, 'public'));
    }

    // Step 4: Download Node.js portable
    console.log('\n📥 下载 Node.js 便携版...');
    const nodeZipPath = path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64.zip`);

    if (!fs.existsSync(nodeZipPath)) {
        await downloadFile(NODE_URL, nodeZipPath);
    } else {
        console.log('   ✅ 使用缓存的 Node.js');
    }

    // Step 5: Extract Node.js
    console.log('\n📦 解压 Node.js...');
    const nodeDest = path.join(outputDir, 'node');
    fs.mkdirSync(nodeDest, { recursive: true });

    try {
        execSync(`unzip -o "${nodeZipPath}" -d "${outputDir}"`, { stdio: 'pipe' });
        const extractedDir = path.join(outputDir, `node-v${NODE_VERSION}-win-x64`);
        if (fs.existsSync(extractedDir)) {
            const entries = fs.readdirSync(extractedDir);
            for (const entry of entries) {
                const src = path.join(extractedDir, entry);
                const dest = path.join(nodeDest, entry);
                if (fs.statSync(src).isDirectory()) {
                    copyDir(src, dest);
                } else {
                    fs.copyFileSync(src, dest);
                }
            }
            fs.rmSync(extractedDir, { recursive: true });
        }
        console.log('   ✅ 解压完成');
    } catch (e) {
        console.log('   ⚠️  解压失败，请手动解压 node.zip');
        fs.copyFileSync(nodeZipPath, path.join(outputDir, 'node.zip'));
    }

    // Clean up unnecessary Node.js files
    const nodeDir = path.join(outputDir, 'node');
    const filesToRemove = ['npm', 'npm.cmd', 'npx', 'npx.cmd', 'corepack', 'corepack.cmd',
                           'install_tools.bat', 'CHANGELOG.md', 'LICENSE', 'node_etw_provider.man'];
    filesToRemove.forEach(file => {
        const filePath = path.join(nodeDir, file);
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
        }
    });
    // Remove npm from node_modules
    const npmDir = path.join(nodeDir, 'node_modules', 'npm');
    if (fs.existsSync(npmDir)) {
        fs.rmSync(npmDir, { recursive: true });
    }

    // Step 6: Create launcher scripts
    console.log('\n📝 创建启动器...');

    const launcherBat = `@echo off
title 五子棋对战 Gomoku Battle
color 0A
cd /d "%~dp0"

if not exist "node\\node.exe" (
    echo.
    echo ========================================
    echo   [错误] 未找到 Node.js 运行时
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo        五子棋对战 (Gomoku Battle)
echo ========================================
echo.
echo [信息] 正在启动服务器...
echo [信息] 本机访问: http://localhost:3000
echo [信息] 局域网访问: http://YOUR_IP:3000
echo.
echo [提示] 按 Ctrl+C 停止服务器
echo ========================================
echo.

set NODE_ENV=production
"%~dp0node\\node.exe" server.js

if errorlevel 1 (
    echo.
    echo [错误] 启动失败！
    pause
)
`;

    fs.writeFileSync(path.join(outputDir, '启动游戏.bat'), launcherBat);

    const launcherVbs = `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = WScript.ScriptFullName
appDir = fso.GetParentFolderName(scriptPath)
nodeExe = fso.BuildPath(appDir, "node\\node.exe")
serverJs = fso.BuildPath(appDir, "server.js")

If Not fso.FileExists(nodeExe) Then
    MsgBox "未找到 Node.js 运行时！", vbCritical, "五子棋对战"
    WScript.Quit 1
End If

WshShell.CurrentDirectory = appDir
WshShell.Run "cmd /c """ & nodeExe & """ " & serverJs, 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:3000", 1

MsgBox "五子棋对战已启动！" & vbCrLf & "浏览器将自动打开游戏页面。", vbInformation, "五子棋对战"
`;

    fs.writeFileSync(path.join(outputDir, '启动游戏(静默).vbs'), launcherVbs);

    const readme = `╔══════════════════════════════════════════════════════════════╗
║                  五子棋对战 (Gomoku Battle)                    ║
║                      完整便携版                                ║
╚══════════════════════════════════════════════════════════════╝

【运行方法】
─────────────────────────────────────────────────────────────────
✅ 直接双击 "启动游戏.bat" 运行

启动后，在浏览器中访问:
  • 本机访问: http://localhost:3000
  • 局域网访问: http://<你的IP>:3000

【系统要求】
─────────────────────────────────────────────────────────────────
  • Windows 7 或更高版本
  • ✅ 无需安装任何依赖！（已内置 Node.js）

【游戏模式】
─────────────────────────────────────────────────────────────────
  • PvP: 本地双人对战
  • PvE: 人机对战（AI 为白方）
  • LAN: 局域网多人对战

【停止服务器】
─────────────────────────────────────────────────────────────────
  • 关闭命令行窗口，或按 Ctrl+C

【局域网多人游戏】
─────────────────────────────────────────────────────────────────
  1. 查看本机 IP 地址：打开命令行，输入 ipconfig
  2. 将 http://<你的IP>:3000 告诉朋友
  3. 朋友在同一局域网内用浏览器访问该地址
  4. 一人创建房间，另一人加入

祝游戏愉快！🎮
`;

    fs.writeFileSync(path.join(outputDir, '使用说明.txt'), readme, 'utf8');

    // Step 7: Calculate total size
    console.log('\n📊 计算文件大小...');
    const getSize = (dir) => {
        let size = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                size += getSize(fullPath);
            } else {
                size += fs.statSync(fullPath).size;
            }
        }
        return size;
    };

    const totalSize = getSize(outputDir);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);

    console.log('\n========================================');
    console.log('  ✅ 打包完成！');
    console.log('========================================\n');
    console.log(`📁 输出目录: ${outputDir}`);
    console.log(`📏 总大小: ${sizeMB} MB`);
    console.log('\n📋 包含文件:');
    console.log('   ├── 启动游戏.bat         (启动服务器)');
    console.log('   ├── 启动游戏(静默).vbs   (后台启动)');
    console.log('   ├── 使用说明.txt');
    console.log('   ├── node/               (Node.js 运行时)');
    console.log('   ├── server.js           (服务器程序)');
    console.log('   └── ... (应用文件)');
    console.log('\n📤 分发方式:');
    console.log('   1. 压缩整个文件夹为 ZIP');
    console.log('   2. 发给朋友解压');
    console.log('   3. 双击 启动游戏.bat 即可运行');
    console.log('\n✅ 用户无需安装任何依赖！');
    console.log('');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
