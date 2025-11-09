# 本地测试与用法指南

## 🚀 快速开始

```bash
# 1. 安装依赖（如果还没有）
npm install

# 2. 运行测试
node test-local.js
```

## 📊 测试用例说明

测试脚本包含以下测试用例：

1. **原始 YAML 配置测试** - 验证 GitHub Gist 示例能否正确解析出 HY2/TUIC/VLESS 节点
2. **空代理数组测试** - 确认 `proxies: []` 时不会产生节点
3. **混合类型与无效节点** - 仅返回受支持协议，忽略未知类型
4. **Base64 编码 YAML** - 验证 Base64 包裹的 Clash YAML 能被解码并解析

## 🎯 预期结果

- ✅ 所有测试通过：YAML 解析功能正常工作
- ⚠️ 部分失败：需要检查具体实现

## 📋 测试输出示例

```
🧪 测试: 原始 YAML 配置测试
📝 输入: [您的 YAML 配置内容]
📊 解析结果: 3 个代理节点
✅ 测试结果: 通过
  1. HY2-main (hysteria2)
  2. TUIC-main (tuic)
  3. VLESS-REALITY (vless)
```

## 🔧 故障排除

如果测试失败，请检查：
1. Node.js 版本是否兼容
2. 依赖是否正确安装
3. 测试脚本是否在正确目录运行

---

**准备好测试了吗？** 运行 `node test-local.js` 来验证您的 YAML 解析功能！

## 🌐 在线接口用法（参数化规则）

- 目标：Clash、SingBox、Surge、Xray（/xray-config）
- 规则选择：`selectedRules` 可使用预置名（minimal/balanced/comprehensive）或传入 URL 编码的 JSON；`customRules` 传 URL 编码后的 JSON。
- 公共参数：
  - `lang`（默认 zh-CN）
  - `ua` 自定义 User-Agent（默认 curl/7.74.0）
  - `group_by_country=true|false`（默认 false）：启用按国家分组/聚合（Clash/SingBox/Xray 支持）
- Xray 专属：
  - `use_balancer=true|false`（默认 false）：是否启用 balancer（auto_select/country_*）自动选择；与 `group_by_country` 配合可实现按国家聚合

### 示例

- Clash（预置 minimal 规则集）：
  - `/clash?config=<ENCODED_SUB>&selectedRules=minimal&customRules=%5B%5D`
- SingBox（自定义 JSON 规则）：
  - `/singbox?config=<ENCODED_SUB>&selectedRules=%7B...%7D&customRules=%5B...%5D`
- Xray（开启 balancer）：
  - `/xray-config?config=<ENCODED_SUB>&selectedRules=minimal&customRules=%5B%5D&use_balancer=true`
- Xray（按国家分组）：
  - `/xray-config?config=<ENCODED_SUB>&selectedRules=balanced&group_by_country=true`
- Xray（关闭 balancer，使用首个出站作为默认）：
  - `/xray-config?config=<ENCODED_SUB>&selectedRules=%7B...%7D&customRules=%5B...%5D&use_balancer=false`
