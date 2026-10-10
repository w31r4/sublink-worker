# 固定订阅：地址不变，配置可更新

`/c/<code>`、`/b/<code>`、`/s/<code>`、`/x/<code>` 分别输出 Clash、Sing-Box、Surge 和 Xray。同一短码对应一份可编辑的订阅记录。修改输入源、规则、基础配置或 Clash DNS 覆盖后，客户端仍访问原地址。

已有短链继续按旧逻辑工作。在「固定订阅管理」载入并保存后，它才迁移为新格式；域名和短码保持不变。新格式直接输出配置，不重定向到包含旧参数的长链接。

## 启用

1. 备份现有 Worker 版本和 `SUBLINK_KV`。使用当前 Worker 的实际名称、域名和 KV namespace，不能依据仓库默认配置或自动 `setup-kv` 的命名猜测。
2. 设置一个独立、随机的 `SUBLINK_ADMIN_TOKEN` Worker Secret。管理界面使用这个密钥，不使用 Cloudflare API Token。Node/Vercel/Docker 使用同名环境变量。
3. 部署本分支，保留原 KV 绑定。管理 API 在未设置密钥时返回 503；下载订阅不需要管理密钥。

```sh
npx wrangler secret put SUBLINK_ADMIN_TOKEN --config wrangler.production.toml
npx wrangler deploy --config wrangler.production.toml
```

不要对已有部署直接执行会自动选择或创建 namespace 的 `npm run deploy`。更换 KV 会使原短链找不到记录。管理密钥应保存为 Worker Secret 或本机仅当前用户可读的文件，不提交仓库。

## 网页使用

1. 展开「固定订阅管理」，输入管理密钥。
2. 粘贴现有短链或短码，点击「载入现有订阅」。新建时留空。
3. 在原有转换表单编辑输入源、规则、基础配置。在管理面板编辑 Clash 覆盖配置，例如 DNS、sniffer 或 TUN。
4. 点击「保存固定订阅」。原地址保持不变；首次创建返回四种格式的固定地址。
5. 各设备手动刷新，或在客户端启用自动更新。响应头 `profile-update-interval` 给出建议间隔；是否遵循由客户端决定。Surge 的 `MANAGED-CONFIG` 使用稳定地址。

管理密钥只保留在当前页面内存。转换表单仍沿用上游的 localStorage 行为。不同设备管理同一个订阅时，先载入再修改。版本检查能发现读到的记录已变更，但 KV 没有原子 compare-and-swap，不能保证并发写入不会互相覆盖；请一次使用一个编辑窗口。

Cloudflare KV 是最终一致存储，修改可能需要 60 秒或更久才能在其他地区读到。`Cache-Control: no-store` 防止额外 HTTP 缓存，不能取消 KV 的传播时间。参考：[Cloudflare KV 一致性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)。

## DNS 覆盖

面板提供国内 / 国际 DNS 模板：复用「国内服务」的 `cn`、`geolocation-cn` 域名规则集，命中时使用国内 DNS；其余默认通过对应语言的「节点选择」代理组查询境外 DoH。点击模板会确保选中 `Location:CN`，生成所需的 domain 类型 provider。`cn-ip` 是 IP 规则集，不能用于决定域名如何解析。

不另建 AI 域名名单：OpenAI、Claude、Gemini 等未命中国内域名集时自然使用海外 DNS。DoH 地址带 `#节点选择`，因此查询的传输也走代理；请在该组选择海外节点。DNS 服务器域名和代理节点地址使用国内 bootstrap DNS，避免循环依赖；这不是把目标 AI 域名交给国内 DNS。网页/API 的访问出口继续由流量规则和所选 AI 代理组决定。客户端自行使用 DoH 或本地覆写时，不能仅凭订阅模板保证没有 DNS 泄漏。

覆盖在节点生成之后应用：对象递归合并，数组替换，`null` 删除对应项。模板通过 `null` 清除旧的 geosite 国内/国外 DNS 分支，并清空旧 fallback/direct-nameserver，避免与新逻辑叠加；最终下载配置不含这些 `null` 项。其他 `nameserver-policy` 域名项（包括公司 DNS 例外）继续保留。节点、代理组、provider 和 rules 仍由原有转换表单管理，不能放进覆盖编辑框。参考：[Mihomo DNS 配置](https://wiki.metacubex.one/config/dns/)。

企业 DNS 例外示例（不要给所有设备添加公司专属策略）：

```yaml
dns:
  fake-ip-filter:
    - '+.corp.example'
  nameserver-policy:
    '+.corp.example':
      - system
```

客户端本地增强配置仍可能覆盖服务器内容。迁移后核对最终运行配置；订阅更新无法自动移除本机覆写、系统 DNS 或 VPN 策略。

## 管理 API

所有 `/api/subscriptions` 请求使用 `Authorization: Bearer <SUBLINK_ADMIN_TOKEN>`，响应不缓存。JSON 正文：

```json
{
  "query": "?config=YOUR_URL_ENCODED_INPUT&selectedRules=balanced&lang=zh-CN",
  "clashOverrides": {"dns": {"nameserver-policy": {"geosite:cn,private": ["https://dns.alidns.com/dns-query"]}}},
  "baseConfig": null,
  "updateIntervalHours": 1
}
```

- `POST /api/subscriptions`：创建随机短码，返回 `201` 和记录，包括 `code`、`revision`。
- `GET /api/subscriptions/<code>`：载入新旧记录，返回 `ETag`。旧记录只读取，保存时才迁移。
- `PUT /api/subscriptions/<code>`：提交完整编辑状态，携带上次读取的 `If-Match: "<revision>"`。缺少该头返回 `428`，版本不匹配返回 `409`。
- `baseConfig` 可以为 `{ "type": "clash", "content": { ... } }`，也支持 `singbox` / `surge`。Surge 使用 JSON 对象或转换表单；`clashOverrides` 支持对象或 YAML 字符串。
- 旧 query 的 `configId` 在迁移时复制为记录内的基础配置快照，管理记录不设置 TTL。引用已过期会报错，需要先恢复基础配置。
- 设置管理密钥后，旧 `/shorten-v2` 覆盖现有链接也需要认证。已迁移记录只能用新管理 API 更新。未启用管理时，旧接口保持既有行为。

订阅地址仍是下载凭据，持有地址的人可以下载节点配置；管理密钥独立控制修改权限。

## 回退

未迁移记录时，可以回滚 Worker 版本。迁移后的 JSON 记录不能被旧 Worker 识别：回滚前应恢复对应 KV 快照，或将记录的 `query` 写回原短码；内嵌基础配置需要重新存为原版 `/config` 记录并恢复 `configId`，覆盖配置也需要另行保留。生产迁移前备份对应 KV 值，不要在仍有迁移记录时直接回滚旧代码。
