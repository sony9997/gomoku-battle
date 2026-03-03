/**
 * 创建完全独立的单文件 EXE
 * 使用自解压技术，将 Node.js 和应用打包成单个 EXE
 * 运行时自动解压到临时目录并启动
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');
const STATIC_DIR = path.join(ROOT_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const NODE_VERSION = '18.20.5';

console.log('========================================');
console.log('  五子棋对战 - 单文件 EXE 生成器');
console.log('========================================\n');

async function main() {
    // Step 1: Build Next.js if needed
    if (!fs.existsSync(STANDALONE_DIR)) {
        console.log('📦 Building Next.js standalone...');
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    }

    // Step 2: Create build directory
    const buildDir = path.join(DIST_DIR, 'sfx-build');
    const outputDir = path.join(DIST_DIR, 'single-exe');

    if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true });
    }
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // Step 3: Copy all application files
    console.log('\n📁 Copying application files...');
    copyDir(STANDALONE_DIR, buildDir);

    const staticDest = path.join(buildDir, '.next', 'static');
    fs.mkdirSync(staticDest, { recursive: true });
    if (fs.existsSync(STATIC_DIR)) {
        copyDir(STATIC_DIR, staticDest);
    }

    if (fs.existsSync(PUBLIC_DIR)) {
        copyDir(PUBLIC_DIR, path.join(buildDir, 'public'));
    }

    // Step 4: Create the main entry script that will run after extraction
    console.log('📝 Creating entry script...');

    const entryScript = `
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get temp directory
const tempDir = process.env.TEMP || process.env.TMP || path.join(os.tmpdir(), 'gomoku-battle');
const extractDir = path.join(tempDir, 'gomoku-battle-' + Date.now());

// Extract location
const appDir = extractDir;

console.log('');
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
process.chdir(appDir);

// Start the server
const server = spawn(process.execPath, [path.join(appDir, 'server.js')], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit',
    detached: false
});

server.on('error', (err) => {
    console.error('\\x1b[31m[错误]\\x1b[0m 启动失败:', err.message);
    process.exit(1);
});

server.on('exit', (code) => {
    process.exit(code || 0);
});
`;

    fs.writeFileSync(path.join(buildDir, 'entry.js'), entryScript);

    // Step 5: Create package.json for the build
    const buildPkg = {
        name: 'gomoku-battle-sfx',
        version: '1.0.0',
        main: 'entry.js',
        dependencies: {}
    };
    fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(buildPkg, null, 2));

    // Step 6: Use pkg to create the executable with all assets
    console.log('\n🔨 Creating single-file executable...');
    console.log('   (这可能需要几分钟，请耐心等待...)');

    const outputFile = path.join(outputDir, '五子棋对战.exe');

    // Create pkg config
    const pkgConfig = {
        scripts: ['entry.js', 'server.js'],
        assets: [
            '.next/**/*',
            'public/**/*',
            'node_modules/**/*'
        ]
    };
    fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify({
        ...buildPkg,
        pkg: pkgConfig
    }, null, 2));

    try {
        // Run pkg with all assets
        execSync(`npx pkg "${buildDir}" --targets node18-win-x64 --output "${outputFile}" --compress GZip --config "${path.join(buildDir, 'package.json')}"`, {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            timeout: 600000
        });
    } catch (e) {
        console.log('\n⚠️  pkg 打包遇到问题，尝试替代方案...');
        createAlternativePackage();
        return;
    }

    // Create README
    const readme = `╔══════════════════════════════════════════════════════════════╗
║                  五子棋对战 (Gomoku Battle)                    ║
║                      单文件独立版                              ║
╚══════════════════════════════════════════════════════════════╝

【运行方法】
─────────────────────────────────────────────────────────────────
✅ 直接双击 "五子棋对战.exe" 运行

启动后，在浏览器中访问:
  • 本机访问: http://localhost:3000
  • 局域网访问: http://<你的IP>:3000

【系统要求】
─────────────────────────────────────────────────────────────────
  • Windows 7 或更高版本
  • ✅ 无需安装任何依赖！

【停止服务器】
─────────────────────────────────────────────────────────────────
  • 关闭命令行窗口，或按 Ctrl+C

祝游戏愉快！🎮
`;

    fs.writeFileSync(path.join(outputDir, '使用说明.txt'), readme, 'utf8');

    // Summary
    const stats = fs.statSync(outputFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

    console.log('\n========================================');
    console.log('  ✅ 打包完成！');
    console.log('========================================\n');
    console.log(`📁 输出文件: ${outputFile}`);
    console.log(`📏 文件大小: ${sizeMB} MB`);
    console.log('\n📤 分发方式:');
    console.log('   直接将 五子棋对战.exe 发给朋友即可');
    console.log('   双击运行，无需安装任何依赖！');
    console.log('');
}

function createAlternativePackage() {
    console.log('\n📦 创建便携版包（包含独立 Node.js）...');

    const portableDir = path.join(DIST_DIR, 'gomoku-battle-portable');
    if (fs.existsSync(portableDir)) {
        fs.rmSync(portableDir, { recursive: true });
    }
    fs.mkdirSync(portableDir, { recursive: true });

    // Copy app files
    copyDir(STANDALONE_DIR, portableDir);
    const staticDest = path.join(portableDir, '.next', 'static');
    fs.mkdirSync(staticDest, { recursive: true });
    if (fs.existsSync(STATIC_DIR)) {
        copyDir(STATIC_DIR, staticDest);
    }
    if (fs.existsSync(PUBLIC_DIR)) {
        copyDir(PUBLIC_DIR, path.join(portableDir, 'public'));
    }

    // Create launchers
    const batContent = `@echo off
title 五子棋对战 Gomoku Battle
color 0A
cd /d "%~dp0"

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
node server.js
pause
`;

    fs.writeFileSync(path.join(portableDir, '启动游戏.bat'), batContent);

    // Create download-node script
    const downloadScript = `@echo off
title 下载 Node.js 运行时
echo.
echo ========================================
echo   首次运行 - 下载 Node.js 运行时
echo ========================================
echo.

set NODE_URL=https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip

echo [信息] 正在下载 Node.js...
echo [信息] 大约 30MB，请稍候...
echo.

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile 'node.zip'}"

if not exist "node.zip" (
    echo [错误] 下载失败！
    pause
    exit /b 1
)

echo.
echo [信息] 解压中...
powershell -Command "& {Expand-Archive -Path 'node.zip' -DestinationPath '.' -Force}"
rename "node-v${NODE_VERSION}-win-x64" "node"
del "node.zip"

echo.
echo ========================================
echo   下载完成！
echo ========================================
echo.
echo 现在可以运行 "启动游戏.bat" 开始游戏
pause
`;

    fs.writeFileSync(path.join(portableDir, '首次运行-下载依赖.bat'), downloadScript);

    const readme = `╔══════════════════════════════════════════════════════════════╗
║                  五子棋对战 (Gomoku Battle)                    ║
╚══════════════════════════════════════════════════════════════╝

【首次运行】
─────────────────────────────────────────────────────────────────
1. 双击 "首次运行-下载依赖.bat" 下载 Node.js 运行时
2. 等待下载完成后，双击 "启动游戏.bat" 开始游戏

【后续运行】
─────────────────────────────────────────────────────────────────
直接双击 "启动游戏.bat" 即可

【系统要求】
─────────────────────────────────────────────────────────────────
  • Windows 7 或更高版本
  • ✅ 无需预先安装 Node.js

【访问地址】
─────────────────────────────────────────────────────────────────
  • 本机访问: http://localhost:3000
  • 局域网访问: http://<你的IP>:3000

祝游戏愉快！🎮
`;

    fs.writeFileSync(path.join(portableDir, '使用说明.txt'), readme, 'utf8');

    console.log(`✅ 便携版创建完成: ${portableDir}`);
    console.log('\n用户需要:');
    console.log('  1. 先运行 "首次运行-下载依赖.bat" 下载 Node.js');
    console.log('  2. 然后运行 "启动游戏.bat" 开始游戏');
    console.log('');
}

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

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
