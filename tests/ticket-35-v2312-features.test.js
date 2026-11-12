const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');

console.log('=== 开始 Ticket-35 Antigravity 2.31.2 (2.31.2.0) 官方版本适配与新特性专项测试 ===\n');

const root = path.join(__dirname, '..');
const localizePath = path.join(root, 'localize.js');
const localizeSource = fs.readFileSync(localizePath, 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'extracted', 'package.json'), 'utf-8'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
const readmeEnSource = fs.readFileSync(path.join(root, 'README.en.md'), 'utf-8');
const changelogSource = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf-8');
const changelogEnSource = fs.readFileSync(path.join(root, 'CHANGELOG.en.md'), 'utf-8');
const readyAsarPath = path.join(root, 'app.asar.ready');

let passed = 0;
let total = 0;

function check(desc, actual, expected) {
  total++;
  try {
    assert.strictEqual(actual, expected);
    console.log(`PASS [${total}]: ${desc} => "${actual}"`);
    passed++;
  } catch (err) {
    console.error(`FAIL [${total}]: ${desc}`);
    console.error(`   期望: "${expected}"`);
    console.error(`   实际: "${actual}"`);
  }
}

// 1. 2.31.2 版本元数据一致性校验（向后兼容 >= 2.31.2）
console.log('--- 1. 2.31.2 版本元数据校验 ---');
function isVerGte2312(ver) {
  if (!ver) return false;
  const parts = ver.split('.').map(n => parseInt(n, 10));
  if (parts[0] > 2) return true;
  if (parts[0] === 2 && parts[1] > 31) return true;
  if (parts[0] === 2 && parts[1] === 31 && parts[2] >= 2) return true;
  return false;
}

const currVerMatch = localizeSource.match(/const CURRENT_VERSION = '([^']+)';/);
check('localize.js CURRENT_VERSION 有效且 >= 2.31.2', isVerGte2312(currVerMatch ? currVerMatch[1] : ''), true);
check('extracted/package.json version 有效且 >= 2.31.2', isVerGte2312(packageJson.version), true);
const indexVerMatch = indexSource.match(/控制中心 v([0-9.]+)/);
check('index.html 控制中心显示版本 >= v2.31.2', isVerGte2312(indexVerMatch ? indexVerMatch[1] : ''), true);
const readmeVerMatch = readmeSource.match(/Antigravity v([0-9.]+)\+/);
check('README.md 标注适配版本 >= v2.31.2+', isVerGte2312(readmeVerMatch ? readmeVerMatch[1] : ''), true);
const readmeEnVerMatch = readmeEnSource.match(/Antigravity v([0-9.]+)\+/);
check('README.en.md 标注适配版本 >= v2.31.2+', isVerGte2312(readmeEnVerMatch ? readmeEnVerMatch[1] : ''), true);
check('CHANGELOG.md 包含 v2.31.2 章节', changelogSource.includes('## v2.31.2 (2026-11-12)'), true);
check('CHANGELOG.en.md 包含 v2.31.2 章节', changelogEnSource.includes('## v2.31.2 (2026-11-12)'), true);
check('app.asar.ready package.json 版本有效且 >= 2.31.2', isVerGte2312(readAsarPackageVersion(readyAsarPath)), true);

// 2. 提取 DOM 翻译引擎验证 2.31.2 静态词条与动态模式匹配
console.log('\n--- 2. 2.31.2 Web UI 静态词条与动态正则断言 ---');
function extractTranslator() {
  const match = localizeSource.match(/(const DOM_TRANSLATOR_INJECTION = `[\s\S]*?`;)/);
  if (!match) throw new Error('未能在 localize.js 中找到 DOM_TRANSLATOR_INJECTION 定义');
  const hostSandbox = { globalThis: {} };
  vm.createContext(hostSandbox);
  vm.runInContext(match[1].replace('const DOM_TRANSLATOR_INJECTION', 'globalThis.DOM_TRANSLATOR_INJECTION'), hostSandbox);
  const injectionCode = hostSandbox.globalThis.DOM_TRANSLATOR_INJECTION.replace(
    "if (document.readyState === 'loading')",
    'globalThis.__test_translateString = translateString;\n  if (typeof document !== "undefined" && document.readyState === "loading")'
  );
  const sandbox = {
    globalThis: {},
    document: { body: null, readyState: 'loading', addEventListener: () => {} },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 },
    Element: { prototype: {} },
    MutationObserver: class { observe() {} disconnect() {} },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(injectionCode, sandbox);
  return sandbox.globalThis.__test_translateString;
}

const translateString = extractTranslator();

const STATIC_CASES = [
  ['Code Preview', '代码预览'],
  ['Download files', '下载文件'],
  ['Allow/deny agent browser file downloads from specific sites.', '允许/禁止智能体从特定站点下载浏览器文件。'],
  ['Allow the browser agent to download a file?', '允许浏览器智能体下载文件吗？'],
  ['Yes, allow this download', '是，允许此次下载'],
  ['Coordinators', '协调器'],
  ['No coordinators', '暂无协调器'],
  ['Create Coordinator', '创建协调器'],
  ['Coordinator goal', '协调器目标'],
  ['What should this coordinator accomplish?', '此协调器需要完成什么目标？'],
  ['No swarm in this conversation', '此对话中暂无集群协作'],
  ['Project location', '项目位置'],
  ['Use Existing', '使用现有项'],
  ['Toggle Google Cloud projects', '切换 Google Cloud 项目列表'],
  ['Summarizing call…', '正在总结通话…'],
  ['Trouble signing in? Enter authorization code', '登录遇到问题？输入授权码'],
  ['Authorization code', '授权码'],
  ['Paste authorization code', '粘贴授权码'],
  ['Submit code', '提交授权码'],
  ['Authorization code was rejected. Paste a fresh code and try again.', '授权码被拒绝，请粘贴新的授权码后重试。'],
  ['Needs your approval', '需要你的批准'],
  ['Waiting for your answer', '等待你的回答'],
  ['Plan upgrade required', '需要升级订阅方案'],
  ['Ask /btw', '使用 /btw 提问']
];

for (const [input, expected] of STATIC_CASES) {
  check(`静态词条 "${input}"`, translateString(input), expected);
}

const DYNAMIC_CASES = [
  ['Yes, allow downloads from github.com for this run', '是，本次运行允许从 github.com 下载'],
  ['Yes, allow downloads from storage.googleapis.com in this conversation', '是，在此对话中允许从 storage.googleapis.com 下载'],
  ['Yes, always allow downloads from releases.example.org', '是，始终允许从 releases.example.org 下载'],
  ['Low contrast ratio (2.4:1). Text may be hard to read.', '对比度过低 (2.4:1)，文本可能难以阅读。'],
  ['Hey Alex, what should we build today?', '嗨 Alex，今天我们要构建什么？'],
  ['Welcome back, Alex. Where should we pick up?', '欢迎回来，Alex。我们要从哪里继续？'],
  ["Good to see you, Alex. What's next?", '很高兴见到你，Alex。接下来做什么？']
];

for (const [input, expected] of DYNAMIC_CASES) {
  check(`动态模式 "${input}"`, translateString(input), expected);
}

// 3. preload.js 与 app.asar.ready 产物验证
console.log('\n--- 3. preload.js 与 app.asar.ready 打包产物验证 ---');
const preloadSource = fs.readFileSync(path.join(root, 'extracted', 'dist', 'preload.js'), 'utf-8');
const asarSource = fs.readFileSync(readyAsarPath).toString('utf-8');

check('preload.js 含 2.31.2 补充分组注释', preloadSource.includes('===== 2.31.2 补充：'), true);
check('preload.js 含 协调器 (Coordinators) 词条', preloadSource.includes('"Coordinators": "协调器"'), true);
check('preload.js 含 授权码登录提示词条', preloadSource.includes('登录遇到问题？输入授权码'), true);
check('preload.js 含 浏览器域名下载动态规则', preloadSource.includes('是，本次运行允许从 '), true);

check('app.asar.ready 包含 协调器', asarSource.includes('协调器'), true);
check('app.asar.ready 包含 允许浏览器智能体下载文件吗？', asarSource.includes('允许浏览器智能体下载文件吗？'), true);
check('app.asar.ready 包含 登录遇到问题？输入授权码', asarSource.includes('登录遇到问题？输入授权码'), true);
check('app.asar.ready 包含 切换 Google Cloud 项目列表', asarSource.includes('切换 Google Cloud 项目列表'), true);

console.log(`\n测试汇总: 通过: ${passed}, 失败: ${total - passed}, 总计: ${total}`);
if (passed === total) {
  console.log('Ticket-35 校验全部通过！');
  process.exit(0);
} else {
  console.error('Ticket-35 校验存在失败项！');
  process.exit(1);
}
