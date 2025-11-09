<div align="center">
  <h1><b>Sublink Worker</b></h1>
  <h5><i>Best Practice for Serverless Self-Deployed Subscription Conversion Tool</i></h5>
  
  <a href="https://trendshift.io/repositories/12291" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/12291" alt="7Sageer%2Fsublink-worker | Trendshift" width="250" height="55"/>
  </a>
  
  <!-- <p>
    <a href="https://sublink-worker.sageer.me">https://sublink-worker.sageer.me</a>
  </p> -->
  <br>

  <p>
    <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create">
      <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers"/>
    </a>
  </p>
  
  <p><a href="/docs/README_CN.md">中文文档</a></p>
</div>

## 🚀 Quick Start

### Quick Deployment
- Fork this project, click the `Deploy to Cloudflare` button above
- Select your repository in the `Import Repository` section (you need to link your GitHub account)
- Change the `Deploy Command` as follows, then select `Save and Deploy`
``` bash
npm run deploy
```

## ✨ Features

### Supported Protocols
- Shadowsocks (including legacy style URLs)
- VMess
- VLESS
- Trojan
- Hysteria2
- TUIC
- Anytls

### Core Features
- Support for importing Base64 http/https subscription links and various protocol sharing URLs
- Pure JavaScript + Cloudflare Worker implementation, one-click deployment, ready to use
- Support for fixed/random short link generation (based on KV)
- Light/Dark theme toggle
- Flexible API, supporting script operations
- Parser → IR → Builder pipeline keeps protocol support consistent across clients
- Support for Chinese, English, Persian, and Russian languages

### Client Support
- Sing-Box
- Clash / Clash.Meta
- Surge
- Xray / V2Ray

### Web Interface Features
- User-friendly operation interface
- Various predefined rule sets
- Customizable policy groups for geo-site, geo-ip, ip-cidr, and domain-suffix

## 📖 API Documentation

For detailed API documentation, please refer to [APIDoc.md](/docs/APIDoc.md)

### Main Endpoints
- `/singbox` - Generate Sing-Box configuration (JSON)
- `/clash` - Generate Clash configuration (YAML)
- `/surge` - Generate Surge configuration (text)
- `/xray-config` - Generate Xray configuration (JSON)
- `/sub` - Convert input subscription into an Xray-compatible Base64 feed
- `/shorten` - Legacy short-link endpoint (stores the full query string)
- `/shorten-v2` - KV-backed short-link code generator for `/b|c|x|s/{code}`
- `/config` (POST) - Persist custom base configurations into KV for 30 days
- `/resolve` - Expand a previously generated short link back to its original URL/query

## 📝 Recent Updates

### 2025-11-09

- Switched to the Parser → IR → Builder architecture; builders now consume a unified IR
- Added the Surge builder and completed TUIC/Hysteria2/Anytls mappings for every client
- New docs: `docs/ARCHITECTURE.md` and `docs/MAINTENANCE.md`

### 2025-09-28

- Fixed warnings caused by some configurations in Singbox 1.12.0
- Various other small issues

## 🔧 Project Structure

```
src/
├── index.js                 # Worker entry, registers routes
├── handlers.js              # Request handlers + builder orchestration
├── parsers/                 # Protocol parsers that emit IR nodes
│   └── index.js             # Parser chain dispatcher
├── ir/
│   ├── factory.js           # createVmessNode/createTuicNode/... helpers
│   └── maps/                # mapIRToClash/Singbox/Surge/Xray
├── BaseConfigBuilder.js     # Shared builder utilities
├── SingboxConfigBuilder.js  # Sing-Box builder
├── ClashConfigBuilder.js    # Clash builder
├── SurgeConfigBuilder.js    # Surge builder
├── XrayConfigBuilder.js     # Xray builder
├── htmlBuilder.js           # Web UI generator
├── utils.js / style.js      # Helper utilities & CSS
└── config.js                # Rule-set metadata and presets

docs/
├── APIDoc.md                # API documentation
├── ARCHITECTURE.md          # Parser → IR → Builder overview
├── MAINTENANCE.md           # Contributor/maintenance guide
├── BaseConfig.md            # Custom base config instructions
├── UpdateLogs.md            # Release history
└── FAQ.md                   # Frequently asked questions
```

## 🤝 Contribution

Issues and Pull Requests are welcome to improve this project.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project is for learning and exchange purposes only. Please do not use it for illegal purposes. All consequences resulting from the use of this project are solely the responsibility of the user and are not related to the developer.

## 💰 Sponsorship

<div align="center">
  <h3>Thanks to the following sponsors for their support of this project</h3>
<table border="0">
  <tr>
    <td>
      <a href="https://yxvm.com/" target="_blank" title="YXVM">
        <img src="https://image.779477.xyz/yxvm.png" alt="YXVM" height="60" hspace="20"/>
      </a>
    </td>
    <td>
      <a href="https://github.com/NodeSeekDev/NodeSupport" target="_blank" title="NodeSupport">
        <img src="https://image.779477.xyz/ns.png" alt="NodeSupport" height="60" hspace="20"/>
      </a>
    </td>
  </tr>
</table>
  <p><b>NodeSupport has sponsored this project, thank you for your support!</b></p>
  <p>If you would like to sponsor this project, please contact the developer <a href="https://github.com/7Sageer" style="text-decoration: none;">@7Sageer</a></p>
</div>

## ⭐ Star History

Thanks to everyone who has starred this project! 🌟

<a href="https://star-history.com/#7Sageer/sublink-worker&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=7Sageer/sublink-worker&type=Date" />
 </picture>
</a>
