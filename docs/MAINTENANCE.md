# 维护指南 Maintenance Guide 💡

本项目已经完全切换到 **IR（Intermediate Representation）驱动** 的解析和构建流程。相比 main 分支的“多处 switch + 半成品对象”模式，现在的维护方式更加模块化，也更容易扩展。本文介绍如何在当前架构下迭代功能，以及与旧流程的区别。

---

## 🔄 与旧架构的主要区别

| 维度 | 旧流程（main） | 现流程（IR 驱动） |
|------|----------------|-------------------|
| 解析 | 各 parser/`convertYamlProxyToObject` 直接输出“半结构化”对象，字段不统一 | 所有入口都调用 `src/ir/factory.js` 构造 IR（`createVmessNode` 等） |
| Builder | 通过大段 `switch` 把半成品对象转换成目标配置 | 直接调用 `mapIRToXxx`，只关注目标格式、命名冲突、分组 |
| 扩展协议 | 至少修改两份代码（parser / builder）且易遗漏 | 只需新增 parser + IR 工厂 + map |
| 流程 | 解析、构建逻辑混杂在 `BaseConfigBuilder` | 清晰三段式：Parser → IR → Builder |

---

## 🔧 如何扩展“已有客户端部分支持的新协议”

例如：Clash/Singbox 已支持 Tuic，但 Surge/Xray 尚未支持。现在要让 Surge 也支持 Tuic。

### 步骤

1. **确认 Parser 已产出 IR**  
   * Tuic 的解析器位于 `src/parsers/TuicUrlParser.js`，确保它调用 `createTuicNode`，IR 中包含 `proto.tuic` 所需字段。

2. **补充 Builder 侧映射**  
   * 打开 `src/ir/maps/surge.js`（若未来单独抽出）或当前 `src/SurgeConfigBuilder.js` 中的 `convertProxy`，读取 IR 的 `auth/tls/proto` 字段并格式化为 Surge 字符串。

3. **测试**  
   * 在 `src/parsers/__tests__/` 或 `src/__tests__/` 中新增 case，运行 `npm test`，生成/更新 `.snap`。

### 与旧流程的不同
* 旧模式需在 parser/`convertYamlProxyToObject`/各 builder 中写多遍 Tuic 逻辑；  
* 现在只需关注 IR → 目标客户端这一条链路，parser 不再改动。

---

## 🆕 如何新增一个客户端

假设需要新增 “FooClient”：

1. **复制 Builder 模板**  
   * 可参考 `src/ClashConfigBuilder.js`：继承 `BaseConfigBuilder`，实现 `convertProxy` / `addProxyToConfig` / 分组等方法。

2. **实现 IR 映射**  
   * 在 `src/ir/maps/` 新建 `foo_client.js`，导出 `mapIRToFooClient(ir)`，负责把 IR 字段转换为 `FooClient` 格式。

3. **注册路由**  
   * 在 `src/handlers.js` 增加 `handleFooClient`，调用通用 `handleConfig` 并传入新 Builder。  
   * 在 `src/index.js` 注册 `/foo` 路径。

4. **测试**  
   * 添加 `src/__tests__/FooConfigBuilder.test.js`，使用快照验证输出。

### 与旧流程的不同
* 旧方案要把 FooClient 相关逻辑插入现有的巨大 `BaseConfigBuilder`，且只能重复粘贴各协议 switch。  
* 现在只需：`Builder + mapIRToFooClient + 路由`，解析层完全复用。

---

## 🧭 流程图（当前 IR 驱动）

```
Input (URL / YAML / Subscription)
       │
       ▼
Parser Chain (src/parsers/*.js)
       │ createXYZNode()
       ▼
 IR Node (kind/host/auth/tls/transport/proto…)
       │
       ├─ mapIRToClash    → ClashConfigBuilder
       ├─ mapIRToSingbox  → SingboxConfigBuilder
       ├─ mapIRToXray     → XrayConfigBuilder
       └─ Surge Builder   → 文本配置
```

---

## 🛠️ 日常维护建议

* **新增协议**：先写 parser → IR，再补各客户端 map；记得加测试。  
* **新增客户端**：实现 `mapIRToXxx` + Builder，路由走 `handleConfig` 即可。  
* **修改 IR**：先更新 `src/ir/factory.js`，然后更新对应的 map 和测试。  
* **测试**：`npm test` 会运行 13 个 Vitest 文件 + 快照；任何 IR 结构变化都会同步提示。  
* **部署**：保持 `npm run deploy`，不依赖额外的缓存/动态配置。

---

## 📘 示例：ABC 协议如何接入

假设要新增一个“ABC 协议”，要求如下：

- 链接格式：`abc://token@server.com:1234?mode=fast&foo=bar`
- 必填字段：`token`、`host`、`port`
- 可选字段：`mode`（fast/slow）、`foo`（自定义标记）、`tls=on` 开启 TLS

### 1. Parser

```js
// src/parsers/AbcParser.js
import { parseUrlParams, parseServerInfo } from './url.js';
import { createAbcNode } from '../ir/factory.js';

export class AbcParser {
  canParse(url) { return url.startsWith('abc://'); }

  parse(url) {
    const { addressPart, params, name } = parseUrlParams(url);
    const [token, serverInfo] = addressPart.split('@');
    const { host, port } = parseServerInfo(serverInfo);
    return createAbcNode({
      host,
      port,
      token: decodeURIComponent(token),
      mode: params.mode || 'fast',
      foo: params.foo,
      tls: params.tls === 'on' ? { enabled: true } : undefined,
      tags: name ? [name] : [],
    });
  }
}
```

```js
// src/parsers/index.js
import { AbcParser } from './AbcParser.js';
const parsers = [
  new VmessParser(),
  // …
  new AbcParser(),
];
```

### 2. IR 工厂

```js
// src/ir/factory.js
export function createAbcNode(data) {
  if (!data.token) throw new Error('token is required for ABC');
  const base = createBaseNode({ ...data, kind: 'abc' });
  base.auth = { token: data.token };
  base.mode = data.mode || 'fast';
  if (data.foo) {
    base.ext = { ...(base.ext || {}), foo: data.foo };
  }
  return base;
}
```

### 3. Builder 映射

以 Clash 为例，在 `src/ir/maps/clash.js` 添加：

```js
if (ir.kind === 'abc') {
  return {
    ...base,
    type: 'abc',
    token: ir.auth.token,
    mode: ir.mode,
    ...(ir.tls?.enabled ? { tls: true, servername: ir.tls.sni } : {}),
  };
}
```

Singbox/Surge/Xray 也可以在各自的 map 文件加入类似分支。

### 4. 测试

```js
// src/parsers/AbcParser.test.js
import { describe, it, expect } from 'vitest';
import { AbcParser } from './AbcParser.js';

describe('AbcParser', () => {
  it('parses abc URLs to IR', () => {
    const parser = new AbcParser();
    const ir = parser.parse('abc://token@example.com:1234?mode=slow#MyABC');
    expect(ir).toMatchSnapshot();
  });
});
```

运行 `npm test` 更新快照，即可确保 ABC 协议覆盖所有客户端。

---

## ✅ 总结

* Parser 与 Builder 解耦，维护成本大幅降低。  
* 新协议扩展：**Parser + IR + map** 即可完成。  
* 新客户端扩展：**Builder + map + 路由 + 测试**，无需修改解析层。  
* 快照测试保障 IR/配置输出一致性。

欢迎在 `docs/ARCHITECTURE.md` 了解更多底层结构，如需记录扩展细节，可在 `docs/` 下继续追加说明。 Happy hacking! 😄
