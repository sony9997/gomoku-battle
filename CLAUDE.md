# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

五子棋对战（Gomoku Battle）是一个实时多人五子棋游戏，支持 2D/3D 可视化、AI 对战和局域网多人游戏。

## 环境依赖与安装

### 系统要求

- **Node.js**: >= 18.17.0（推荐使用 LTS 版本 20.x 或 22.x）
- **包管理器**: npm、yarn、pnpm 或 bun 任选其一
- **浏览器**: 支持 WebGL 的现代浏览器（3D 模式需要）

### 安装步骤

```bash
# 1. 克隆项目后进入目录
cd gomoku-battle

# 2. 安装依赖（选择以下任一命令）
npm install
# 或
yarn install
# 或
pnpm install
# 或
bun install

# 3. 启动开发服务器
npm run dev

# 4. 浏览器访问
# http://localhost:3000
```

### 生产环境部署

```bash
# 构建
npm run build

# 启动生产服务器
npm run start
```

### 依赖说明

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| `next` | 16.0.3 | React 全栈框架，提供 App Router |
| `react` | 19.2.0 | UI 库 |
| `react-dom` | 19.2.0 | React DOM 渲染 |
| `socket.io` | 4.8.1 | 服务端 WebSocket 通信，处理房间和实时同步 |
| `socket.io-client` | 4.8.1 | 客户端 WebSocket 连接 |
| `three` | 0.181.2 | 3D 渲染核心库 |
| `@react-three/fiber` | 9.4.0 | React 的 Three.js 渲染器 |
| `@react-three/drei` | 10.7.7 | React Three Fiber 的实用工具集（OrbitControls 等） |

### 开发依赖

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| `typescript` | ^5 | 类型检查 |
| `@types/node` | ^20 | Node.js 类型定义 |
| `@types/react` | ^19 | React 类型定义 |
| `@types/react-dom` | ^19 | React DOM 类型定义 |

### 局域网多人游戏说明

服务器默认监听 `0.0.0.0:3000`，可通过局域网 IP 访问：

```bash
# 查看本机局域网 IP
# macOS/Linux
ipconfig getifaddr en0  # 或 ifconfig

# 其他设备访问
# http://<你的局域网IP>:3000
```

## 开发命令

```bash
npm run dev              # 启动开发服务器（端口 3000，包含 Socket.io）
npm run build            # 生产环境构建
npm run start            # 生产环境运行（NODE_ENV=production）
npm run electron:dev     # 开发模式运行 Electron 应用
npm run electron:build   # 构建 Electron 安装包（Windows + Mac）
npm run electron:build:win  # 仅构建 Windows 版本
```

## Electron 桌面应用打包

项目支持打包成独立的桌面应用程序，内置 Chromium 浏览器，用户无需安装任何依赖。

### 打包命令

```bash
npm run electron:build:win   # 构建 Windows 便携版 EXE
```

### 输出位置

```
release/
├── 五子棋对战-便携版.exe    # 单文件，双击即可运行（约 136MB）
└── win-unpacked/           # 解压后的文件夹（可选）
```

### 打包说明

- **文件大小**: 约 136MB（含 Chromium 浏览器 + Node.js）
- **系统要求**: Windows 7+ 64位
- **无需依赖**: 内置浏览器，无需安装 Node.js 或浏览器
- **分发方式**: 直接发送 `五子棋对战-便携版.exe`

### Electron 配置

- 入口文件: `electron.js`
- 配置: `package.json` 中的 `build` 字段
- 支持目标: Windows (portable/nsis), macOS (dmg)

## 架构说明

### 服务端层 (`server.js`)

自定义 Node.js 服务器，集成 Next.js 与 Socket.io。负责：
- 局域网多人游戏的房间创建/加入
- 实时落子同步
- 每个房间的游戏状态管理（棋盘、回合、玩家）
- 玩家断开连接的清理

### 客户端层 (`src/app/page.js`)

主游戏组件，包含：
- 游戏状态（15x15 棋盘 = 225 个格子、回合追踪、胜负判定）
- 三种游戏模式：PvP（本地双人对战）、PvE（人机对战）、LAN（局域网多人）
- Socket.io 客户端集成，实现实时通信
- 2D/3D 视图切换

### 组件

- `Board.js` - 使用 CSS Grid 渲染 2D 棋盘
- `Board3D.js` - 使用 React Three Fiber 渲染 3D 棋盘，支持 OrbitControls 旋转
- `Square.js` - 单个棋格，显示棋子/悬停预览

### 游戏逻辑

- `gameLogic.js` - 胜负判定（从最后落子位置向 4 个方向检查五子连珠）
- `aiLogic.js` - 基于启发式的 AI，使用棋型评分评估攻防位置（活二/三/四、死二/三/四、胜利）

### 棋盘数据结构

- 一维数组，225 个元素（15x15）
- 索引公式：`row * 15 + col`
- 取值：`null`（空）、`'Black'`（黑子）、`'White'`（白子）

## 技术栈

- Next.js 16（App Router）
- React 19
- Socket.io 4.8（服务端 + 客户端）
- React Three Fiber + Drei（3D 渲染）
- Three.js
- TypeScript（严格模式，但组件文件使用 JS）

## 关键模式

### 不可变性

棋盘状态更新使用 `slice()` 和展开运算符。永远不要直接修改 squares 数组。

### Socket.io 事件

- 客户端 → 服务端：`createRoom`、`joinRoom`、`makeMove`、`resetGame`
- 服务端 → 客户端：`roomCreated`、`roomJoined`、`gameStart`、`moveMade`、`gameReset`、`playerDisconnected`

### AI 决策逻辑

AI（`aiLogic.js`）评估每个空位的进攻和防守潜力，优先级：
1. 立即获胜
2. 阻止对手获胜
3. 活棋型（未被阻挡的连子）
