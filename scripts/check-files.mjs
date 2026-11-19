#!/usr/bin/env node
/**
 * 发布前自检：确保所有要发布的文件都是干净的 UTF-8（无 BOM）。
 *
 * 为什么：npm 的包如果 package.json 带 BOM，JSON.parse 会报
 *   SyntaxError: Unexpected token '﻿'
 * 导致 DSH 之类的宿主拒绝安装。这个坑真踩过。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['package.json'];
const SCAN_DIRS = ['cli', 'src', 'adapters', 'docs', 'personas'];
const EXTRA = ['AGENTS.md', 'README.md', 'LICENSE', '.env.example'];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = [
  ...TARGETS.map((f) => join(ROOT, f)),
  ...EXTRA.map((f) => join(ROOT, f)),
  ...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))),
];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const bad = [];

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue;
  }
  if (buf.length >= 3 && buf.subarray(0, 3).equals(BOM)) {
    bad.push(relative(ROOT, file));
  }
}

if (bad.length) {
  console.error('✖ 以下文件带 UTF-8 BOM，会导致宿主 JSON 解析失败：');
  for (const f of bad) console.error(`   · ${f}`);
  console.error('\n修复：去掉文件开头的 EF BB BF 三个字节，或重新以「UTF-8 无 BOM」保存。');
  process.exit(1);
}

console.log(`✔ 检查了 ${files.length} 个文件，没有 BOM`);
