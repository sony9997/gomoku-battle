/**
 * scripts/copy-standalone.js
 *
 * Build 后执行，完成以下工作：
 *   1. 找到 .next/standalone 里的项目镜像目录
 *   2. 复制 .next/static → standalone/<project>/.next/static
 *   3. 复制 public/      → standalone/<project>/public
 *   4. 复制 socket.io 等依赖 → standalone/<project>/node_modules/
 *   5. 用我们自己的 server.js 覆盖 standalone 里 Next.js 自动生成的 server.js
 *   6. 将 standalone 项目目录的相对路径写入 .next/standalone-path.json，供 electron.js 动态读取
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// 找到 standalone 里的项目镜像目录（含 server.js + package.json 的目录）
// ─────────────────────────────────────────────────────────────────────────────
function findStandaloneProjectRoot(standaloneDir) {
    function search(dir, depth) {
        if (depth > 15) return null;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch (e) { return null; }
        const hasServer = entries.some(e => e.isFile() && e.name === 'server.js');
        const hasPkg = entries.some(e => e.isFile() && e.name === 'package.json');
        if (hasServer && hasPkg) return dir;
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const found = search(path.join(dir, entry.name), depth + 1);
                if (found) return found;
            }
        }
        return null;
    }
    return search(standaloneDir, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 递归复制目录
// ─────────────────────────────────────────────────────────────────────────────
function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠️  源目录不存在，跳过: ${path.relative(ROOT, src)}`);
        return 0;
    }
    fs.mkdirSync(dest, { recursive: true });
    let count = 0;
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            count += copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            count++;
        }
    }
    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
const standaloneDir = path.join(ROOT, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
    console.error('❌ .next/standalone 不存在，请先执行: npm run build');
    process.exit(1);
}

const projectRoot = findStandaloneProjectRoot(standaloneDir);
if (!projectRoot) {
    console.error('❌ 无法在 .next/standalone 中找到项目根目录（含 server.js + package.json）');
    process.exit(1);
}

// 记录相对路径（相对于 .next/standalone）
const projectRelPath = path.relative(standaloneDir, projectRoot);
console.log('✅ standalone 项目目录:', projectRelPath);

// ─── 1. 复制 .next/static ───────────────────────────────────────────────────
const n = copyDir(
    path.join(ROOT, '.next', 'static'),
    path.join(projectRoot, '.next', 'static')
);
console.log(`📁 .next/static → standalone 内 (${n} 文件)`);

// ─── 2. 复制 public ─────────────────────────────────────────────────────────
const m = copyDir(
    path.join(ROOT, 'public'),
    path.join(projectRoot, 'public')
);
console.log(`📁 public → standalone 内 (${m} 文件)`);

// ─── 3. 复制 socket.io 等额外依赖 ───────────────────────────────────────────
const EXTRA_MODULES = [
    'socket.io',
    'socket.io-parser',
    'socket.io-adapter',
    'engine.io',
    'engine.io-parser',
    '@socket.io',
    'ws',
    'accepts',
    'base64id',
    'cors',
    'debug',
    'ms',
    'mime',
];

const destNodeModules = path.join(projectRoot, 'node_modules');
fs.mkdirSync(destNodeModules, { recursive: true });

let copiedMods = 0, skippedMods = 0;
for (const mod of EXTRA_MODULES) {
    const src = path.join(ROOT, 'node_modules', mod);
    const dest = path.join(destNodeModules, mod);
    if (!fs.existsSync(src)) { skippedMods++; continue; }
    if (fs.existsSync(dest)) { skippedMods++; continue; }   // 已存在则跳过
    copyDir(src, dest);
    copiedMods++;
}
console.log(`📦 socket.io 依赖: 复制 ${copiedMods} 个，跳过 ${skippedMods} 个（已存在或不需要）`);

// ─── 4. 替换 standalone 里的 server.js ──────────────────────────────────────
// 用我们自己的 server.js（含 socket.io 逻辑）覆盖 Next.js 自动生成的
fs.copyFileSync(
    path.join(ROOT, 'server.js'),
    path.join(projectRoot, 'server.js')
);
console.log('📄 server.js → standalone 内（已替换）');

// ─── 5. 写入 standalone-path.json（给 electron.js 动态读取路径）────────────
const standalonePathFile = path.join(ROOT, '.next', 'standalone-path.json');
fs.writeFileSync(standalonePathFile, JSON.stringify({ projectRelPath }, null, 2));
console.log('📝 standalone-path.json 写入完成');

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
console.log('✅ 全部完成！');
console.log('   server.js 绝对路径:', path.join(projectRoot, 'server.js'));
console.log('');
