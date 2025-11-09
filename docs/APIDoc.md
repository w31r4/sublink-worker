# Sublink Worker API 文档

## 概述

Sublink Worker 是一个部署在 Cloudflare Workers 上的轻量级订阅转换工具。它可以将各种代理协议的分享 URL 转换为不同客户端可用的订阅链接。本文档概述了 API 端点及其用法。

## 基础 URL

所有 API 请求应发送至:

```
https://your-worker-domain.workers.dev
```

将 `your-worker-domain` 替换为您实际的 Cloudflare Workers 域名。

## 端点

## 端点概览

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/singbox` | GET | 生成 Sing-Box 配置 (JSON) |
| `/clash` | GET | 生成 Clash 配置 (YAML) |
| `/surge` | GET | 生成 Surge 配置 (纯文本) |
| `/xray-config` | GET | 生成 Xray JSON 配置 |
| `/sub` | GET | 将输入/远程订阅统一转换为 Base64 (Xray 兼容) |
| `/shorten` | GET | 为原始 URL 创建短链（返回包含 `shortUrl` 的 JSON） |
| `/shorten-v2` | GET | 仅保存查询串，返回短码以便 `/b|c|x|s/{code}` 重定向 |
| `/config` | POST | 保存自定义基础配置 (KV，默认 30 天过期) |
| `/resolve` | GET | 将短链恢复为原始链接 |
| `/:type(b|c|x|s)/{code}` | GET | 根据短链前缀跳转到 Singbox/Clash/Xray/Surge 入口 |

---

### 1. 生成配置

`/singbox`、`/clash`、`/surge`、`/xray-config` 共用同一套查询参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `config` | 是 | URL 编码后的内容，可包含多行代理链接、Base64 订阅或远程 http(s) 订阅地址（自动抓取并解码） |
| `selectedRules` | 否 | 预设名称 `minimal` / `balanced` / `comprehensive`，或 URL 编码后的 JSON 数组（如 `["Google","Ad Block"]`） |
| `customRules` | 否 | URL 编码后的 JSON 数组。字段：`site`, `ip`, `domain_suffix`, `domain_keyword`, `ip_cidr`, `protocol`, `name`（均为逗号分隔字符串） |
| `group_by_country` | 否 | `true/false`，根据节点名称自动创建国家分组（默认 `false`） |
| `lang` | 否 | 指定界面语言，支持 `zh-CN`、`en-US`、`fa`、`ru`，默认取请求头 `Accept-Language` |
| `ua` | 否 | 抓取远程订阅时使用的 User-Agent，默认 `curl/7.74.0` |
| `configId` | 否 | 通过 `/config` 保存的基础配置 ID（例如 `clash_abcd1234`），用于在生成结果中复用自己的基础配置 |

> 自定义规则会在生成时位于预定义规则之前，便于覆盖默认行为；如果 `selectedRules` 为空则自动回退到 `minimal`。

#### Sing-Box 配置

- **URL**: `/singbox`
- **方法**: GET
- **响应类型**: `application/json`

**示例**:
```
/singbox?config=vmess%3A%2F%2Fexample&selectedRules=balanced&customRules=%5B%7B%22site%22%3A%22example.com%22%2C%22ip%22%3A%22192.168.1.1%22%2C%22domain_suffix%22%3A%22.com%22%2C%22ip_cidr%22%3A%2210.0.0.0%2F8%22%2C%22name%22%3A%22MyCustomRule%22%7D%5D
```

#### Clash 配置

- **URL**: `/clash`
- **方法**: GET
- **参数**: 同 `/singbox`

#### Surge 配置

- **URL**: `/surge`
- **方法**: GET
- **响应类型**: 纯文本（便于远程规则集订阅）

#### Xray JSON 配置

- **URL**: `/xray-config`
- **方法**: GET
- **额外参数**:
  - `use_balancer` (可选): `true/false`，是否启用自动流量分流器（默认 `false`）
- **响应类型**: `application/json`

#### Xray Base64 订阅

- **URL**: `/sub`
- **方法**: GET
- **参数**:
  - `config` (必需): 多行代理/订阅内容（会自动展开远程 http(s) 链接）
  - `ua` (可选): 抓取远程订阅时使用的 UA
- **响应**: Base64 编码的订阅文本

---

### 2. 缩短 URL

#### `/shorten`

- **方法**: GET
- **参数**: `url` (必需) 需要缩短的原始 URL
- **说明**: 适用于一次性分享的完整链接，请求后返回 JSON，包含可直接访问的 `shortUrl`

```
/shorten?url=https%3A%2F%2Fexample.com%2Fvery-long-url
```

**响应示例**:
```json
{
  "shortUrl": "https://your-worker-domain.workers.dev/s/abcdefg"
}
```

#### `/shorten-v2`

- **方法**: GET
- **参数**:
  - `url` (必需): 需要缩短的原始 URL（通常是 `/singbox|clash|xray-config|surge` 链接）
  - `shortCode` (可选): 自定义短码，不传则随机生成
- **说明**: 仅保存查询字符串，并返回短码（纯文本）。可搭配 `/b|c|x|s/{code}` 前缀一次生成 Singbox / Clash / Xray / Surge 四种短链

```
/shorten-v2?url=https%3A%2F%2Fyour-worker-domain.workers.dev%2Fclash%3Fconfig%3Dvmess...&shortCode=myshare
```

**响应**:
```
myshare
```

### 3. 重定向短 URL

- **URL**: `/:type(b|c|x|s)/{shortCode}`
- **方法**: GET
- **描述**: 根据前缀跳转到对应客户端的订阅/配置入口，`shortCode` 由 `/shorten-v2` 返回

| 前缀 | 目标端点 | 输出类型 |
|------|----------|----------|
| `b` | `/singbox` | JSON |
| `c` | `/clash` | YAML |
| `x` | `/sub` | Base64 文本 |
| `s` | `/surge` | 纯文本 |

### 4. 保存 / 读取自定义基础配置

- **URL**: `/config`
- **方法**: POST
- **Content-Type**: application/json
- **请求体**:

  ```json
  {
    "type": "clash" | "singbox",  // 配置类型
    "content": "配置内容"  // 字符串格式的配置内容
  }
  ```

- **响应**: 
  - 成功: 返回配置ID (字符串)
  - 失败: 返回错误信息 (400 状态码)

**说明**:
- 配置内容会进行格式验证
- Clash配置支持YAML和JSON格式
- SingBox配置必须是有效的JSON格式
- 配置将保存30天
- 配置ID可以通过URL参数`configId`使用

**示例**:

``` bash
curl -X POST https://your-worker-domain.workers.dev/config \
-H "Content-Type: application/json" \
-d '{
"type": "clash",
"content": "port: 7890\nallow-lan: false\nmode: Rule"
}'
```

**使用保存的配置**:
将返回的配置ID添加到URL参数中即可使用保存的配置：
```
https://your-worker-domain.workers.dev/clash?config=vmess://xxx&configId=clash_abc123
```

详情请参考[使用说明](#使用说明)

### 5. 解析短链

- **URL**: `/resolve`
- **方法**: GET
- **参数**: `url` (必需) 由 `/b|c|x|s/{code}` 生成的短链（包含完整域名）
- **说明**: 返回 JSON `{ "originalUrl": "https://your-worker-domain.workers.dev/clash?..."}`

---

## 预定义规则集

API 支持以下预定义规则集:

- `minimal`: 基本规则集
- `balanced`: 适中规则集
- `comprehensive`: 完整规则集

这些可以在 Sing-Box / Clash / Surge / Xray 配置的 `selectedRules` 参数中使用。

下面是目前支持的预定义规则集：

| Rule Name | Used Site Rules | Used IP Rules |
|---|---|---|
| Ad Block | category-ads-all |  |
| AI Services | category-ai-!cn |  |
| Bilibili | bilibili |  |
| Youtube | youtube |  |
| Google | google | google |
| Private |  | private |
| Location:CN | geolocation-cn | cn |
| Telegram |  | telegram |
| Microsoft | microsoft |  |
| Apple | apple |  |
| Social Media | facebook, instagram, twitter, tiktok, linkedin |  |
| Streaming | netflix, hulu, disney, hbo, amazon |  |
| Gaming | steam, epicgames, ea, ubisoft, blizzard |  |
| Github | github, gitlab |  |
| Education | coursera, edx, udemy, khanacademy, category-scholar-!cn |  |
| Financial | paypal, visa, mastercard, stripe, wise |  |
| Cloud Services | aws, azure, digitalocean, heroku, dropbox |  |
| Non-China | geolocation-!cn |  |

Singbox 的规则集来自 [https://github.com/lyc8503/sing-box-rules](https://github.com/lyc8503/sing-box-rules), 感谢 lyc8503 的贡献!

## 自定义规则

除了使用预定义规则集,您还可以在 `customRules` 参数中提供自定义规则列表作为 JSON 数组（URL 编码后作为参数值）。每个自定义规则应包含以下字段:

- `site`: 域名规则，逗号分隔的字符串
- `ip`: IP 规则，逗号分隔的字符串
- `domain_suffix`: 域名后缀规则，逗号分隔的字符串
- `domain_keyword`: 域名关键词规则，逗号分隔的字符串
- `ip_cidr`: IP CIDR 规则，逗号分隔的字符串
- `protocol`: 协议规则，逗号分隔的字符串
- `name`: 出站名称

示例:

```json
[
  {
    "site": "google,anthropic",
    "ip": "private,cn",
    "domain_suffix": ".com,.org",
    "domain_keyword": "Mijia Cloud,push.apple",
    "ip_cidr": "192.168.0.0/16,10.0.0.0/8",
    "protocol": "http,tls,dns",
    "name": "🤪 MyCustomRule"
  }
]
```
## 错误处理

API 在出现问题时将返回适当的 HTTP 状态码和错误消息:

- 400 Bad Request: 当缺少必需参数或参数无效时
- 404 Not Found: 当请求的资源(如短 URL)不存在时
- 500 Internal Server Error: 服务器端错误

## 使用说明 / 注意事项

1. 将完整的订阅内容进行 URL 编码后放入 `config`，可混合多行代理、Base64 订阅或 http(s) 链接（会自动拉取并解析）。
2. 多个代理可通过 `%0A` 分隔后放入同一个 `config` 参数。
3. `selectedRules` 需匹配预定义规则表中的名称；未指定时默认 `minimal`。`customRules` 必须是有效的 JSON 数组，优先级高于预定义规则。
4. `group_by_country=true` 会为 Singbox/Clash/Surge/Xray 自动创建国家分组，方便按地区选择。
5. 通过 `/config` 取得的 `configId` 会在 30 天内可用，可在各生成端点通过 `configId` 参数复用，避免重复粘贴基础配置。
6. 短链接存储在 KV 中，建议视作临时分享手段，长期使用请妥善备份原始 URL。

## 示例

- 生成带有平衡规则集并启用国家分组的 Sing-Box 配置:

  ```
  /singbox?config=vmess%3A%2F%2Fxxx&selectedRules=balanced&group_by_country=true
  ```

- 生成英文的 Surge 文本配置：

  ```
  /surge?config=vmess%3A%2F%2Fxxx&lang=en
  ```

- 把多行订阅转为 Base64：

  ```
  /sub?config=ss://xxx%0Avmess://yyy
  ```

- 带自定义规则的 Clash 配置：

  ```
  /clash?config=vless%3A%2F%2Fexample&customRules=%5B%7B%22site%22%3A%22example.com%22%2C%22ip%22%3A%22192.168.1.1%22%2C%22domain_suffix%22%3A%22.com%22%2C%22domain_keyword%22%3A%22Mijia%20Cloud%22%2C%22ip_cidr%22%3A%2210.0.0.0%2F8%22%2C%22protocol%22%3A%22http%22%2C%22name%22%3A%22MyCustomRule%22%7D%5D
  ```

- 使用 `/shorten-v2` 生成通用短码：

  ```
  GET /shorten-v2?url=https%3A%2F%2Fyour-worker-domain.workers.dev%2Fclash%3Fconfig%3D...&shortCode=myshare
  ```

  生成后即可访问：

  ```
  https://your-worker-domain.workers.dev/b/myshare   (Singbox)
  https://your-worker-domain.workers.dev/c/myshare   (Clash)
  https://your-worker-domain.workers.dev/x/myshare   (Xray Base64)
  https://your-worker-domain.workers.dev/s/myshare   (Surge)
  ```

## 结论

Sublink Worker API 提供了一种灵活而强大的方式来生成和管理代理配置。它支持多种代理协议、各种客户端类型和可自定义的路由规则。URL 缩短功能允许轻松共享和管理复杂的配置。
