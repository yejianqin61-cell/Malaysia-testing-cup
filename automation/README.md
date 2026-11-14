# B 层：通用自动化检查（TeaYeah）

> **开关规则：只有 09:30 讲解明确允许自动化/工具时才用。** 不允许或说不清 → 只用 A 层（`competition-day/03-ai-prompts.md`），这个文件夹不碰。

这里的脚本和被测网站无关，当天只换网址。它们**只读、顺序、低频**：不点击、不输入（键盘检查只按 Tab）、不提交表单、不爬链接、不并发，只访问同一主机，总加载次数有上限。

## 赛前准备（今天/明天做完，两台电脑都做）

```powershell
cd automation
npm install
npx playwright install chromium firefox
node run-checks.mjs --url https://demo.playwright.dev/todomvc/ --runs 1 --browsers chromium
```

最后一条跑通（约 30 秒，生成 `out/<时间>/summary.md`）就说明环境 OK。比赛当天不用再下载任何东西。

## 两个工具

### 1. `run-checks.mjs`：非功能一键检查 → NonFunctional 表

| 检查 | 做什么 | 对应评分 |
|---|---|---|
| `perf` | 每页冷启动加载 N 次（每次新浏览器上下文、禁用缓存），报告中位数：Load / DCL / FCP / LCP / TTFB / 请求数 / 传输量；可选 Fast 3G / Slow 4G 限速 | 非功能-性能 |
| `a11y` | axe-core 扫描 WCAG 2.1 A+AA；按 Tab 走一遍，记录焦点顺序和焦点框是否可见 | 非功能-可访问性 |
| `shots` | Chromium + Firefox × 1920 桌面 / 390 手机，整页截图，并自动检查横向溢出 | 非功能-兼容性/响应式 |
| `errors` | 以上所有加载过程中顺带收集：console 报错、未捕获异常、HTTP ≥400、失败请求 | 可靠性 / bug 线索 |

当天常用命令（PowerShell）：

```powershell
# 全部检查，4 个页面，约 2-3 分钟，共 4x3 + 4 + 4x2x2 = 32 次加载
node run-checks.mjs --url https://SUT/ --pages "./,login,products,cart"

# 只测性能，加 Fast 3G 限速
node run-checks.mjs --url https://SUT/ --pages "./,products" --checks perf --throttle fast3g

# 需要登录的页面：先由【人】在弹出的浏览器里登录，保存登录状态
npx playwright codegen --save-storage=auth.json https://SUT/
node run-checks.mjs --url https://SUT/ --pages "account,orders" --auth auth.json

# 也可以把参数写进配置文件
copy targets.example.json targets.json
node run-checks.mjs --config targets.json
```

`--pages` 写相对路径：`./` 是 SUT 首页，`login` 指 SUT 下的 login 页。写 `/login` 会从主机根目录算起。在 Git Bash 里要先 `export MSYS_NO_PATHCONV=1`，否则 `/xxx` 会被改写成 Windows 路径（脚本会拒绝并报错，不会跑到别处）。

输出在 `out/<时间>/`：
- `nonfunctional.csv`：列名和工作簿 NonFunctional 表一致，可直接粘贴。`[REVIEW]` 列（期望基准、用户影响、结论）**必须人工填**。
- `summary.md`：精简版，查询参数已脱敏，可以直接贴给 AI（P10）。
- `perf.json` / `errors.json` / `axe/*.json`：原始数据。`shots/*.png`：截图证据。

### 2. 冒烟/回归：`tests/smoke.spec.mjs`

1. `npx playwright codegen --save-storage=auth.json https://SUT/`：人操作主流程，工具录下代码。
2. 把录到的步骤贴进 `tests/smoke.spec.mjs`，测试名用 TestCases 表的编号（`TC-05 ...`），补上 `expect()` 作为预期结果。
3. 让 AI 整理代码。**只贴代码，不贴 auth.json，不贴密码。**
4. 运行：
   ```powershell
   $env:SUT_URL="https://SUT/"; $env:AUTH="auth.json"; npx playwright test
   npx playwright show-report out/smoke-report
   ```
5. 结果抄回 TestCases 表。**失败 ≠ bug**：先手工复现，再走 Defects 流程（P5 质疑 → 队友复现）。

默认只开 Chromium 桌面，单线程、不重试。要跑 Firefox 或手机，就在 `playwright.config.mjs` 里取消注释（对 SUT 的负载会翻倍）。

## 比赛日怎么插进流程

| 时间 | 谁 | 做什么 |
|---|---|---|
| 0–15 分钟 | B | 侦察时记下 3–5 个关键页面的地址 |
| 15–35 分钟 | B | `run-checks.mjs` 全量跑一次（后台约 3 分钟），同时 A 设计用例 |
| 35–60 分钟 | B | 把 `summary.md` 贴给 AI（P10）分诊 → 人工复核 → 填 NonFunctional 表；可疑项转为 Defects 疑似 |
| 35–145 分钟 | A | 对 1–2 条主流程用 codegen 录冒烟；发现 bug 后用它快速确认复现 |
| 90 分钟 | B | 如果期间站点有明显变化，再用 `--checks perf` 复测一次，用于对比 |
| 145 分钟 | A | 总结报告第 7 节引用 NF 编号和数字 |

每用一次（包括 AI 分诊、AI 整理测试代码），都在 AI_Log 表记一行，写清楚"自动化 + AI 怎么配合、人工怎么验证"。这正是"Smart use of AI tools"的证据。

## 写进报告时的措辞注意

- 性能数字是**实验室测量**（单机、单网络、无头浏览器），不是负载测试。报告里要写明环境、限速档位、重复次数、取的是中位数。
- axe 只能自动发现一部分可访问性问题，"0 违规"不等于"无障碍合格"。
- Tab 焦点框检测是启发式判断，要对照截图或手工确认后再下结论。
- 自动发现的东西都只是**线索**，复现、判断严重程度、去重都要人来做。

## 不能做的事

不加大 `--runs` / `--max-loads` 去"压一压"，不并发，不扫描端口或目录，不碰提交、支付、删除之类的流程（除非讲解明确允许），`auth.json` 不外传（已加进 .gitignore）。
