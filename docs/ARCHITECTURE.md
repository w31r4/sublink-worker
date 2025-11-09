# 架构概览

本项目旨在将各种代理链接 / 订阅内容解析成统一的中间表示（IR），再由不同 Builder 输出目标配置（Clash、Singbox、Surge、Xray）。借助统一的 IR，可以大幅减少重复逻辑，并确保各协议扩展保持一致性。

```
输入（URL、订阅、YAML）
  └─ Parser Chain (src/parsers/*.js)
        ↓ createXYZNode()
      IR（src/ir/factory.js）
        ↓ mapIRToTarget()
  └─ Builder（Clash/Singbox/Surge/Xray）
        ↓ 目标配置
```

---

## 解析层

* 目录：`src/parsers/`
* 所有协议解析器（如 `VmessParser`, `TrojanParser`, `TuicParser` 等）都会调用 `src/ir/factory.js` 中的构造函数（`createVmessNode` 等），确保输出一致的 IR。
* YAML 输入通过 `src/parsers/yamlHelper.js` 直接映射为 IR；HTTP 订阅 (`HttpParser`) 会尝试解析远程 YAML/明文列表并继续走 parser chain。

### Parser 链

* 定义在 `src/parsers/index.js`。
* 顺序尝试每个 parser，返回首个成功的 IR。
* 若某些协议需要新增，只需在 parser 目录添加实现，并在 `parsers/index.js` 注册。

---

## IR 工厂

* 文件：`src/ir/factory.js`
* 提供 `createVmessNode`、`createVlessNode`、`createTrojanNode` 等构造器，内部完成字段校验、tags 规范化、proto/tls 填充。
* 统一字段示例：
  * `kind`：协议类型
  * `host` / `port`
  * `auth`：`uuid/password/method`
  * `tls`：`enabled/sni/alpn/reality/utls`
  * `transport`：`type/path/headers/service_name`
  * `proto`：协议扩展（如 TUIC、Hysteria2）

---

## Builder 层

| Builder | 主要文件 | 输出格式 |
|---------|----------|----------|
| Clash   | `src/ClashConfigBuilder.js` | YAML |
| Singbox | `src/SingboxConfigBuilder.js` | JSON |
| Surge   | `src/SurgeConfigBuilder.js` | 文本 |
| Xray    | `src/XrayConfigBuilder.js` | JSON |

关键特性：

* `convertProxy` 只负责调用 `mapIRToXxx`（位于 `src/ir/maps/*.js`）；不存在重复的 switch。
* 每个 Builder 内部处理节点命名冲突（如 Clash/Singbox/Surge/Xray 各自维护递增后缀）。
* Builder 负责组装 proxy groups、rule sets 等配置细节，解析与协议细节均来自 IR。

---

## 入口 & 路由

* `src/index.js`：Worker 入口，注册路由，主要 Handler 位于 `src/handlers.js`。
* `handleConfig` 会根据路径选择对应 Builder，传入用户配置（订阅文本、rule 选择、UA 等），最后返回目标配置。
* 不依赖额外缓存/并发逻辑；部署只需 `npm run deploy`。

---

## 测试策略

* 运行 `npm test`（Vitest）。
* 解析器与 `yamlHelper` 拥有快照测试，保证 IR 结构稳定：`src/parsers/__snapshots__/*.snap`
* Clash / Singbox Builder 也有快照测试，确保生成的配置与预期一致：`src/__snapshots__/*.snap`

---

## 如何扩展协议/客户端

1. 在 `src/parsers/` 添加解析器，实现 `canParse`/`parse`，并在 `parsers/index.js` 注册。
2. 在 `src/ir/factory.js` 添加新的 `createXxxNode` 或扩展现有结构。
3. 更新对应的 `mapIRToXxx`（Clash/Singbox/Xray/Surge），把新的 IR 字段映射到目标格式。
4. 添加 Vitest 测试和快照，确保新协议在解析和 Builder 两端都有覆盖。
