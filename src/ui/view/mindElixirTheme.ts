// src/ui/view/mindElixirTheme.ts
//
// 给 mind-elixir 提供一份「跟随 Obsidian 主题」的 theme。
// 原理:mind-elixir 会把 theme.cssVar 内联到容器元素的 style 上;
// 我们把每个变量的值设为 `var(--obsidian-var)` 字符串,
// 浏览器再用 Obsidian 主题变量解析 → 自动随深/浅色切换。

import type { Theme } from 'mind-elixir';

export const OBSIDIAN_MINDMAP_THEME: Theme = {
  name: 'obsidian',
  // 分支配色:mind-elixir 按序给一级分支着色(影响分支线条 + 节点边/字)。
  // 用浅色主题那套鲜艳 palette(Catppuccin Latte 风):在深色/浅色 Obsidian
  // 背景上对比都足够。
  palette: [
    '#dd7878', '#ea76cb', '#8839ef', '#e64553', '#fe640b',
    '#df8e1d', '#40a02b', '#209fb5', '#1e66f5', '#7287fd',
  ],
  cssVar: {
    // 间距/圆角保留 mind-elixir 默认观感
    '--node-gap-x': '32px',
    '--node-gap-y': '5px',
    '--main-gap-x': '65px',
    '--main-gap-y': '45px',
    '--root-radius': '30px',
    '--main-radius': '4px',
    '--topic-padding': '3px',
    '--map-padding': '50px',

    // 颜色全部通过 Obsidian 主题变量
    '--color': 'var(--text-normal)',
    '--bgcolor': 'var(--background-primary)',

    '--main-color': 'var(--text-accent)',
    '--main-bgcolor': 'var(--background-secondary)',
    '--main-bgcolor-transparent': 'var(--background-secondary)',

    '--root-color': 'var(--text-on-accent)',
    '--root-bgcolor': 'var(--interactive-accent)',
    '--root-border-color': 'var(--interactive-accent)',

    '--selected': 'var(--interactive-accent)',
    '--accent-color': 'var(--interactive-accent)',

    '--panel-color': 'var(--text-normal)',
    '--panel-bgcolor': 'var(--background-secondary)',
    '--panel-border-color': 'var(--background-modifier-border)',
  },
};
