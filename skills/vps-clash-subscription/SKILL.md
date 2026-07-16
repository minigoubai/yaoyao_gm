---
name: vps-clash-subscription
description: 在任意VPS上搭建完整的Clash订阅服务 — 包含HTTPS订阅、Let's Encrypt证书、域名配置、安全策略、国内分流规则、自动续期
triggers:
  - 在VPS上搭建VPN订阅服务
  - 搭建clash订阅
  - VPS科学上网
  - 自建订阅节点
  - Let's Encrypt证书配置
  - 翻墙 机场 自建
---

# VPS Clash Subscription Service / VPS Clash 订阅服务搭建完整指南

> **English:** A complete guide to building a Clash subscription service on any VPS — covering HTTPS subscription, Let's Encrypt certificates, domain configuration, security policies, China mainland direct routing rules, and automatic certificate renewal.
>
> **中文：** 在任意 Linux VPS 上搭建 Clash 订阅服务的完整指南。包含 HTTPS 订阅下载、正式 TLS 证书、国内网站直连分流、订阅防探测等核心内容。

---

## Table of Contents / 目录

- [Architecture / 架构说明](#architecture--架构说明)
- [Prerequisites / 前置要求](#prerequisites--前置要求)
- [Port Planning / 端口规划](#port-planning--端口规划)
- [Security Configuration / 安全配置](#security-configuration--安全配置)
- [Deployment Steps / 部署步骤](#deployment-steps--部署步骤)
  - [Step 1: Register Domain / 第一步：注册域名](#step-1-register-domain--第一步注册域名)
  - [Step 2: Open Firewall Ports / 第二步：开放防火墙端口](#step-2-open-firewall-ports--第二步开放防火墙端口)
  - [Step 3: Install Dependencies / 第三步：安装依赖](#step-3-install-dependencies--第三步安装依赖)
  - [Step 4: Install Shadowsocks / 第四步：安装Shadowsocks](#step-4-install-shadowsocks--第四步安装shadowsocks)
  - [Step 5: Configure Subscription Service / 第五步：配置订阅服务](#step-5-configure-subscription-service--第五步配置订阅服务)
  - [Step 6: Apply Let's Encrypt Certificate / 第六步：申请Let's Encrypt证书](#step-6-apply-lets-encrypt-certificate--第六步申请lets-encrypt证书)
  - [Step 7: Configure nginx HTTPS Reverse Proxy / 第七步：配置nginx-HTTPS反代](#step-7-configure-nginx-https-reverse-proxy--第七步配置nginx-https反代)
  - [Step 8: Verify Services / 第八步：验证服务](#step-8-verify-services--第八步验证服务)
- [Clash Client Configuration / Clash客户端配置](#clash-client-configuration--clash客户端配置)
- [Detailed Security Analysis / 安全详解](#detailed-security-analysis--安全详解)
- [Certificate Auto-Renewal / 证书自动续期](#certificate-auto-renewal--证书自动续期)
- [Troubleshooting / 常见问题](#troubleshooting--常见问题)
- [Quick Reference / 快速参考](#quick-reference--快速参考)

---

## Architecture / 架构说明

```
┌─────────────────┐    HTTPS (443)       ┌──────────────────┐   HTTP (65534)    ┌────────────────┐
│  Clash Client   │ ──────────────────→  │      nginx       │ ───────────────→ │  Python Sub    │
│ (Clash Verge)  │   TLS Termination     │  Reverse Proxy    │                  │  Service       │
└─────────────────┘                      └──────────────────┘                  │ (127.0.0.1)    │
                                                                                 └───────┬────────┘
                                                                                         │
                                                                                         ↓
                                                                          ┌────────────────────────┐
                                                                          │   Clash YAML Config     │
                                                                          │   - Proxy Node Info     │
                                                                          │   - Routing Rules       │
                                                                          │   - rule-providers      │
                                                                          └────────────────────────┘

┌─────────────────┐    SS Encrypted (8388)  ┌──────────────────┐
│  Clash Client   │ ←──────────────────────  │  Shadowsocks     │ ←── Internet
│ (Actual Traffic)│    TCP+UDP              │  ss-server       │     Target Sites
└─────────────────┘                         └──────────────────┘
```

### Key Points / 关键说明

| 层级 | 说明 / Description | 安全要点 / Security Notes |
|------|-------------------|--------------------------|
| HTTPS 订阅下载 | **Only used for subscription config download (one-time)** | TLS encrypted, prevents eavesdropping |
| 实际代理流量<br>Actual Proxy Traffic | **Goes directly through Shadowsocks, NOT through nginx** | SS protocol encryption (chacha20/aes) |
| nginx | TLS termination, listens on public 0.0.0.0:443 | Python sub service only on 127.0.0.1 |
| Python Sub Service | Generates and serves Clash YAML | Token-based path auth, no auth bypass |

**Traffic flow / 流量走向：**
- Subscription download: `Clash Client → HTTPS → nginx:443 → HTTP → Python:65534 → Clash YAML`
- Actual browsing: `Clash Client → SS encrypted → VPS:8388 → Target Website`
- nginx is ONLY in the subscription download path, NOT in the actual proxy path.

---

## Prerequisites / 前置要求

| 要求 / Requirement | 说明 / Description | 推荐 / Recommended |
|-------------------|---------------------|-------------------|
| **VPS** | 任意 Linux，Ubuntu 24.04 验证通过<br>Any Linux, Ubuntu 24.04 tested | Ubuntu 20.04+ / Debian 12+ / CentOS 8+ |
| **公网IP / Public IP** | VPS 必须有公网 IPv4<br>VPS must have public IPv4 | 记下 IP 地址，例如 43.155.161.178 |
| **域名 / Domain** | duckdns.org 免费子域名<br>Free subdomain at duckdns.org | 也支持 Cloudflare / 阿里云 / 腾讯云等其他域名 |
| **防火墙 / Firewall** | VPS 防火墙（如 ufw/iptables）+ 云服务商安全组<br>VPS firewall + cloud security group | 需要同时配置 |
| **Clash Client** | Clash Verge / Clash for Windows / ClashX | [Clash Verge 下载](https://github.com/clash-verge-rev/clash-verge-rev) |

---

## Port Planning / 端口规划

| 端口<br>Port | 协议<br>Protocol | 用途<br>Purpose | 暴露公网？<br>Public? | 备注 |
|-------------|-----------------|----------------|---------------------|------|
| 80 | TCP | Let's Encrypt 证书申请（临时）<br>Certificate verification (temporary) | **是 / Yes** | 申请后可以关闭 |
| 443 | TCP | HTTPS 订阅访问<br>HTTPS subscription access | **是 / Yes** | 主要访问端口 |
| 8388 | TCP+UDP | Shadowsocks 代理端口<br>SS proxy port | **是 / Yes** | 实际流量入口 |
| 65534 | TCP | Python 订阅服务（仅本地）<br>Python sub service (local only) | **否 / No** | nginx 反代后间接访问 |
| 9090 | TCP | Clash 管理 API（仅本地）<br>Clash management API (local only) | **否 / No** | 用于控制器 |
| 51820 | UDP | WireGuard 备用隧道（可选）<br>WireGuard backup tunnel (optional) | **是 / Yes** | 如需备用方案 |

> **⚠️ 云服务商安全组注意 / Cloud Security Group Note:**
> 如果使用云服务商（AWS / 阿里云 / 腾讯云 / Vultr / DigitalOcean 等），防火墙有两层：
> - **VPS 内部防火墙**（ufw / iptables）：用 `sudo ufw allow 443/tcp` 开放
> - **云控制台安全组**（Security Group）：需要在云服务商网页手动添加入站规则
> 两层都要开，否则端口不通。

---

## Security Configuration / 安全配置

### Security Checklist / 安全检查清单

| 配置项 / Config | 危险后果（不设置会怎样）<br>Risk if not set | 推荐值 / Recommended |
|----------------|-------------------------------------------|---------------------|
| `allow-lan: false` | **全球任何人都能用你的 VPS 代理流量，账单爆炸** | `false` |
| `bind-address: "127.0.0.1"` | SS 代理端口暴露公网，任何人可直连你的翻墙节点 | `"127.0.0.1"` |
| `external-controller: 127.0.0.1` | 任何人可远程控制你的 Clash 配置，修改规则、添加代理 | `127.0.0.1:9090` |
| DNS 8.8.8.8 / 1.1.1.1 | DNS 查询经过国内服务器，隐私泄露，可被审查 | 境外 DNS |
| Let's Encrypt 证书 | 自签证书需要客户端忽略警告，且密码明文传输有 MITM 风险 | Let's Encrypt |
| 订阅路径 32 位随机 token | 订阅路径被猜测，配置泄露，被蹭网或审查 | 32 位 hex |
| nginx 反代 | Python 服务不直接暴露公网，只通过 nginx 访问 | 必须配置 |

### Password Generation / 密码生成规范

```bash
# 生成强密码 / Generate strong password
openssl rand -base64 32
# 示例输出 / Example: YmVvcmT5c2VjcmV0a2V5ISEhMzIuLi4=

# 生成订阅路径 token / Generate subscription token
openssl rand -hex 32
# 示例输出 / Example: 819aa2e8bbf0e8df81325b8f14c8d919532feff1fb56b5aa55de45e77016ca58
```

**密码强度建议 / Password Strength Recommendations:**
- 最少 16 位 / Minimum 16 characters
- 包含数字 + 字母 + 特殊字符 / Include digits + letters + special chars
- 定期更换 / Rotate periodically

---

## Deployment Steps / 部署步骤

### Step 1: Register Domain / 第一步：注册域名

**为什么需要域名？/ Why domain is required:**
- Let's Encrypt 不支持纯 IP 签发证书（标准限制）
- duckdns.org 提供**免费子域名**，5 分钟搞定，无需信用卡
- 支持任何 DNS 提供商（Cloudflare / 阿里云 / 腾讯云等均可）

#### duckdns.org 注册步骤 / Registration Steps:

1. 访问 https://www.duckdns.org
2. 点击 **GitHub** 或 **Google** 登录（推荐，无需注册）
3. 点击 "Create your domain"
4. 输入子域名前缀（如 `myvps`），系统自动生成 `myvps.duckdns.org`
5. 在 IPv4 框填入你的 VPS 公网 IP（如 `43.155.161.178`）
6. 点击 **save**

#### 验证域名解析 / Verify DNS Resolution:

```bash
nslookup myvps.duckdns.org 8.8.8.8
# 应返回 / Should return: Address: 43.155.161.178
```

> **⚠️ 注意事项 / Note:** duckdns 免费域名有效期无限，但 **30 天不登录会被删除**。建议收藏保存登录状态。

---

### Step 2: Open Firewall Ports / 第二步：开放防火墙端口

**⚠️ 两层防火墙都要开！/ BOTH firewall layers need configuration!**

#### 2.1 VPS 内部防火墙 / VPS Internal Firewall:

```bash
# 查看防火墙状态 / Check firewall status
sudo ufw status

# 如果是关闭状态 / If disabled:
sudo ufw enable

# 开放必要端口 / Open required ports
sudo ufw allow 80/tcp   # 证书申请 / Certificate verification
sudo ufw allow 443/tcp  # HTTPS 订阅 / HTTPS subscription
sudo ufw allow 8388/tcp # Shadowsocks TCP
sudo ufw allow 8388/udp # Shadowsocks UDP

# 验证规则 / Verify rules
sudo ufw status numbered
```

#### 2.2 云服务商安全组 / Cloud Provider Security Group:

需要在**云服务商控制台**手动添加入站规则（不是 Linux 内部防火墙）：

| 协议<br>Protocol | 端口<br>Port | 来源<br>Source | 说明<br>Description |
|-----------------|-------------|----------------|-------------------|
| TCP | 80 | 0.0.0.0/0 | 证书申请临时开放 |
| TCP | 443 | 0.0.0.0/0 | HTTPS 订阅访问 |
| TCP | 8388 | 0.0.0.0/0 | SS 代理 TCP |
| UDP | 8388 | 0.0.0.0/0 | SS 代理 UDP |

**常见云服务商安全组入口：**
- **AWS EC2**: EC2 Dashboard → Instances → Security → Security Groups
- **阿里云 ECS**: ECS Console → 实例 → 安全组 → 配置规则
- **腾讯云 CVM**: CVM Console → 实例 → 安全组 → 入站规则
- **Vultr / DigitalOcean**: Firewall → Add Rule

> **验证端口是否通 / Verify port is reachable:**
> ```bash
> nc -zv 你的VPS_IP 443
> # Connection succeeded 说明通了
> ```

---

### Step 3: Install Dependencies / 第三步：安装依赖

```bash
# 更新系统 / Update system
sudo apt-get update && sudo apt-get upgrade -y

# 安装核心软件 / Install core packages
sudo apt-get install -y \
    shadowsocks-libev \    # SS 服务器
    nginx \                # 反向代理
    certbot \              # Let's Encrypt 证书工具
    python3-certbot-nginx  # certbot nginx 插件

# 验证安装 / Verify installation
ss-server --version    # 应显示版本号 / should show version
nginx -v               # 应显示版本号 / should show version
certbot --version      # 应显示版本号 / should show version
```

---

### Step 4: Install Shadowsocks / 第四步：安装Shadowsocks

#### 4.1 创建 systemd 服务 / Create systemd service:

```bash
sudo nano /etc/systemd/system/shadowsocks.service
```

内容 / Content:
```ini
[Unit]
Description=Shadowsocks Libev Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/ss-server -s 0.0.0.0 -p 8388 -k 你的SS密码 -m chacha20-ietf-poly1305 -u
Restart=on-abort
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

#### 4.2 启动并设置开机自启 / Start and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable shadowsocks
sudo systemctl start shadowsocks

# 验证运行状态 / Verify status
sudo systemctl status shadowsocks
ss -tlnp | grep 8388   # 应显示 0.0.0.0:8388 LISTEN
```

#### 4.3 加密方式说明 / Encryption Methods:

| 加密方式 | 推荐度 | 说明 |
|---------|-------|------|
| `chacha20-ietf-poly1305` | ⭐⭐⭐⭐⭐ | **推荐**，抗审查，性能好，省电 |
| `aes-256-gcm` | ⭐⭐⭐⭐ | 也支持，部分设备性能较好 |
| `aes-128-gcm` | ⭐⭐⭐ | 可用，但强度稍低 |
| `rc4-md5` | ⭐ | **不推荐**，已被破解 |

---

### Step 5: Configure Subscription Service / 第五步：配置订阅服务

#### 5.1 生成订阅路径 token / Generate subscription token:

```bash
openssl rand -hex 32
# 记录输出，例如 / Note output: 819aa2e8bbf0e8df81325b8f14c8d919532feff1fb56b5aa55de45e77016ca58
```

#### 5.2 创建订阅服务脚本 / Create subscription service script:

```bash
sudo nano /tmp/sub_server.py
```

**⚠️ 重要：修改下面三处 / IMPORTANT: Modify these 3 places:**
1. `你的VPS公网IP` → 替换为你的实际 VPS IP
2. `你的SS密码` → 替换为你的 SS 密码
3. `上面openssl生成的32位token` → 替换为上一步生成的 token

```python
#!/usr/bin/env python3
"""
Clash Subscription Service / Clash 订阅服务
Holds the complete Clash YAML config and serves it via HTTP.
"""
import http.server
import socketserver
import json
from datetime import datetime

# ========== 配置 / CONFIGURATION ==========
VPS_IP = "你的VPS公网IP"          # 例如 / e.g. "43.155.161.178"
SS_PASSWORD = "你的SS密码"        # 例如 / e.g. "MyStr0ngP@ss!"
SS_PORT = 8388
SS_METHOD = "chacha20-ietf-poly1305"
SUBSCRIPTION_TOKEN = "上面openssl生成的32位token"  # 例如 / e.g. "819aa2e8bbf0e8df81325b8f14c8d919532feff1fb56b5aa55de45e77016ca58"

# ========== Clash YAML 配置 / Clash YAML Config ==========
CLASH_YAML = f"""port: 7890
socks-port: 7891
mixed-port: 7892
redir-port: 7893
allow-lan: false
bind-address: "127.0.0.1"
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 127.0.0.1:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 8.8.8.8
    - 1.1.1.1
  fallback:
    - 8.8.8.8
    - 1.1.1.1
  fallback-filter:
    geoip: true
    geoip-code: CN

proxies:
  - name: "VPS-SS"
    type: ss
    server: {VPS_IP}
    port: {SS_PORT}
    cipher: {SS_METHOD}
    password: "{SS_PASSWORD}"
    udp: true

proxy-groups:
  - name: "Auto"
    type: select
    proxies:
      - "VPS-SS"

rule-providers:
  chinamax:
    type: http
    behavior: classical
    url: "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/ChinaMax/ChinaMax_Classical.yaml"
    path: ./chinamax.yaml
    interval: 86400

rules:
  # === 中国大陆域名直连 / China domain direct ===
  - DOMAIN-SUFFIX,cq.cn,DIRECT
  - DOMAIN-SUFFIX,cn,DIRECT
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,baidubcr.com,DIRECT
  - DOMAIN-SUFFIX,bdstatic.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,weixin.com,DIRECT
  - DOMAIN-SUFFIX,tencent.com,DIRECT
  - DOMAIN-SUFFIX,tencent-cloud.com,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,tmall.com,DIRECT
  - DOMAIN-SUFFIX,alipay.com,DIRECT
  - DOMAIN-SUFFIX,alibaba.com,DIRECT
  - DOMAIN-SUFFIX,alicdn.com,DIRECT
  - DOMAIN-SUFFIX,aliyun.com,DIRECT
  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT
  - DOMAIN-SUFFIX,dingtalk.com,DIRECT
  - DOMAIN-SUFFIX,dingtalk.org,DIRECT
  - DOMAIN-SUFFIX,ele.me,DIRECT
  - DOMAIN-SUFFIX,meituan.com,DIRECT
  - DOMAIN-SUFFIX,meituan-ec.com,DIRECT
  - DOMAIN-SUFFIX,163.com,DIRECT
  - DOMAIN-SUFFIX,126.com,DIRECT
  - DOMAIN-SUFFIX,youku.com,DIRECT
  - DOMAIN-SUFFIX,iqiyi.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT
  - DOMAIN-SUFFIX,bilivideo.com,DIRECT
  - DOMAIN-SUFFIX,douyin.com,DIRECT
  - DOMAIN-SUFFIX,bytedance.com,DIRECT
  - DOMAIN-SUFFIX,byted.org,DIRECT
  - DOMAIN-SUFFIX,toutiao.com,DIRECT
  - DOMAIN-SUFFIX,zhihu.com,DIRECT
  - DOMAIN-SUFFIX,csdn.net,DIRECT
  - DOMAIN-SUFFIX,jd.com,DIRECT
  - DOMAIN-SUFFIX,360.cn,DIRECT
  - DOMAIN-SUFFIX,360cdn.com,DIRECT
  - DOMAIN-SUFFIX,sina.com,DIRECT
  - DOMAIN-SUFFIX,weibo.com,DIRECT
  - DOMAIN-SUFFIX,redian.cn,DIRECT
  - DOMAIN-SUFFIX,gov.cn,DIRECT
  - DOMAIN-SUFFIX,miit.gov.cn,DIRECT
  - DOMAIN-SUFFIX,10086.cn,DIRECT
  - DOMAIN-SUFFIX,chinatelecom.com,DIRECT
  - DOMAIN-SUFFIX,189.cn,DIRECT
  - DOMAIN-SUFFIX,10010.com,DIRECT
  - DOMAIN-SUFFIX,10086.cn,DIRECT
  - DOMAIN-SUFFIX,cucc.com,DIRECT
  - DOMAIN-SUFFIX,suning.com,DIRECT
  - DOMAIN-SUFFIX,gome.com,DIRECT
  - DOMAIN-SUFFIX,vip.com,DIRECT
  - DOMAIN-SUFFIX,pinduoduo.com,DIRECT
  - DOMAIN-SUFFIX,xianyu.com,DIRECT
  - DOMAIN-SUFFIX,huawei.com,DIRECT
  - DOMAIN-SUFFIX,huaweiwei.com,DIRECT
  - DOMAIN-SUFFIX,honor.cn,DIRECT
  - DOMAIN-SUFFIX,xiaomi.com,DIRECT
  - DOMAIN-SUFFIX,mi.com,DIRECT
  - DOMAIN-SUFFIX,redmi.com,DIRECT
  - DOMAIN-SUFFIX,oppo.com,DIRECT
  - DOMAIN-SUFFIX,vivo.com,DIRECT
  - DOMAIN-SUFFIX,oneplus.com,DIRECT
  - DOMAIN-SUFFIX,zte.com,DIRECT
  - DOMAIN-SUFFIX,lenovo.com,DIRECT
  - DOMAIN-SUFFIX,chinacache.com,DIRECT

  # === 中国大陆关键词直连 / China keyword direct ===
  - DOMAIN-KEYWORD,cq.cn,DIRECT
  - DOMAIN-KEYWORD,baidu,DIRECT
  - DOMAIN-KEYWORD,alibaba,DIRECT
  - DOMAIN-KEYWORD,taobao,DIRECT
  - DOMAIN-KEYWORD,tencent,DIRECT
  - DOMAIN-KEYWORD,bytedance,DIRECT
  - DOMAIN-KEYWORD,zhihu,DIRECT
  - DOMAIN-KEYWORD,csdn,DIRECT
  - DOMAIN-KEYWORD,aliyun,DIRECT
  - DOMAIN-KEYWORD,dingtalk,DIRECT
  - DOMAIN-KEYWORD,ele.me,DIRECT

  # === 中国大陆 IP 段直连 / China IP ranges direct ===
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - IP-CIDR,224.0.0.0/4,DIRECT
  - IP-CIDR,240.0.0.0/4,DIRECT

  # === rule-providers: ChinaMax 规则集 / ChinaMax rule set ===
  - RULE-SET,chinamax,DIRECT

  # === GEOIP: 中国大陆 IP 走直连 / GEOIP CN direct ===
  - GEOIP,CN,DIRECT

  # === 默认走代理 / Default: use proxy ===
  - MATCH,Auto
"""

# ========== HTTP 服务 / HTTP Server ==========
class SubHandler(http.server.BaseHTTPRequestHandler):
    """订阅处理器 / Subscription request handler"""

    def do_GET(self):
        # 验证订阅路径 / Validate subscription path
        expected_path = f"/ssone/{SUBSCRIPTION_TOKEN}"
        if self.path.startswith(expected_path):
            config = CLASH_YAML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", len(config))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            # 订阅用户信息（可选）/ Subscription userinfo (optional)
            self.send_header(
                "Subscription-Userinfo",
                "upload=0; download=0; total=107374182400000; expire=4102444800"
            )
            self.end_headers()
            self.wfile.write(config)
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        print(f"[订阅/Sub] {args[0]}")

# ========== 启动服务 / Start Service ==========
PORT = 65534
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("0.0.0.0", PORT), SubHandler)
print(f"订阅服务启动 / Subscription service started: http://0.0.0.0:{PORT}/ssone/{SUBSCRIPTION_TOKEN}")
print(f"订阅地址 / Subscription URL: https://你的域名/ssone/{SUBSCRIPTION_TOKEN}")
server.serve_forever()
```

#### 5.3 启动订阅服务 / Start subscription service:

```bash
# 后台运行 / Run in background
nohup python3 /tmp/sub_server.py > /tmp/sub_server.log 2>&1 &

# 验证监听 / Verify listening
sleep 2 && ss -tlnp | grep 65534
# 应显示 / should show: 0.0.0.0:65534 LISTEN

# 测试本地访问 / Test local access
curl -s http://127.0.0.1:65534/ssone/你的TOKEN | head -5
```

---

### Step 6: Apply Let's Encrypt Certificate / 第六步：申请Let's Encrypt证书

#### 6.1 为什么选择 Let's Encrypt？/ Why Let's Encrypt?

| 证书类型 | 优点 | 缺点 |
|---------|------|------|
| 自签证书 | 快速，无域名要求 | Clash 每次导入都要点"忽略警告"，有 MITM 风险 |
| Let's Encrypt | 正式 CA 签发，浏览器/Clash 信任，90 天自动续期 | 需要域名，需要 80 端口验证 |

#### 6.2 申请证书 / Apply certificate:

```bash
sudo certbot certonly --nginx \
  -d 你的duckdns域名 \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email
```

**成功输出示例 / Success output example:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/你的域名/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/你的域名/privkey.pem
This certificate expires on 2026-10-13.
```

#### 6.3 证书文件说明 / Certificate files:

| 文件 | 用途 | 说明 |
|------|------|------|
| `fullchain.pem` | nginx ssl_certificate | 包含完整证书链 |
| `privkey.pem` | nginx ssl_certificate_key | **私钥，切勿泄露** |

---

### Step 7: Configure nginx HTTPS Reverse Proxy / 第七步：配置nginx-HTTPS反代

#### 7.1 创建 nginx 配置 / Create nginx config:

```bash
sudo nano /etc/nginx/sites-available/sub_https
```

内容 / Content:
```nginx
server {
    listen 443 ssl;
    server_name 你的duckdns域名;

    # Let's Encrypt 证书 / Let's Encrypt certificate
    ssl_certificate /etc/letsencrypt/live/你的duckdns域名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的duckdns域名/privkey.pem;

    # TLS 安全配置 / TLS security hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS 可选启用 / Optional HSTS
    # add_header Strict-Transport-Security "max-age=63072000" always;

    # 订阅路径反代 / Subscription path reverse proxy
    location /ssone/你的TOKEN {
        proxy_pass http://127.0.0.1:65534/ssone/你的TOKEN;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 反代超时 / Proxy timeout
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 禁止访问其他路径 / Deny all other paths
    location / {
        return 403;
    }
}
```

#### 7.2 启用配置 / Enable config:

```bash
# 删除默认配置防止冲突 / Remove default config to avoid conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# 启用我们的配置 / Enable our config
sudo ln -sf /etc/nginx/sites-available/sub_https /etc/nginx/sites-enabled/sub_https

# 测试语法 / Test syntax
sudo nginx -t

# 重载 nginx / Reload nginx
sudo systemctl reload nginx
```

---

### Step 8: Verify Services / 第八步：验证服务

```bash
# 1. 检查端口监听 / Check port listening
ss -tlnp | grep -E '443|80|8388|65534'

# 2. 测试本地订阅 / Test local subscription
curl -sk https://127.0.0.1/ssone/你的TOKEN | head -10

# 3. 测试域名订阅 / Test domain subscription
curl -sk https://你的域名/ssone/你的TOKEN | head -10

# 4. 验证证书信息 / Verify certificate
echo | openssl s_client -connect 你的域名:443 -servername 你的域名 2>/dev/null | openssl x509 -no_out -issuer -dates

# 5. 检查 Shadowsocks 运行 / Check Shadowsocks
sudo systemctl status shadowsocks
ss -tlnp | grep 8388
```

**预期结果 / Expected results:**
- `ss -tlnp` 显示 `0.0.0.0:443`, `0.0.0.0:80`, `0.0.0.0:8388`, `127.0.0.1:65534` 监听中
- `curl` 返回完整 Clash YAML 配置
- `openssl x509` 显示 `issuer=Let's Encrypt`, `notAfter` 为 90 天后日期

---

## Clash Client Configuration / Clash客户端配置

### 订阅链接 / Subscription URL

```
https://你的域名/ssone/你的TOKEN
```

### Clash Verge 导入步骤 / Import Steps:

1. 下载安装 [Clash Verge](https://github.com/clash-verge-rev/clash-verge-rev)
2. 点击左侧菜单 **Settings** → **Clash Core** → 选择 **Clash Verge**
3. 点击左侧 **Profiles**
4. 点击 **New Profile** → 选择 **URL**
5. 在 URL 栏填入上面的订阅链接
6. 点击 **Subscribe**
7. 首次使用 Let's Encrypt 证书无需任何警告（权威 CA 签发）
8. 选择 `Auto` 节点，点击 **Set as System Proxy**

---

## Detailed Security Analysis / 安全详解

### Subscription Security / 订阅链路安全

```
Clash Client
    ↓ HTTPS (TLS 1.3 encrypted, MITM-proof)
nginx (TLS termination on port 443)
    ↓ HTTP (localhost only, cannot be accessed externally)
Python Subscription Service
    ↓
Clash YAML (contains SS password)
```

**安全要点：**
- HTTPS 防止订阅内容在传输中被窃听或篡改
- nginx 监听 `0.0.0.0:443`，Python 只监听 `127.0.0.1:65534`
- 外部无法直接访问 Python 服务，只能通过 nginx 反代
- 32 位随机 token 防止订阅路径被猜测或暴力扫描

### Proxy Traffic Security / 代理流量安全

```
Clash Client
    ↓ SS protocol (chacha20-ietf-poly1305 encryption)
Shadowsocks Server (VPS)
    ↓ Decrypted, direct connection
Internet Target
```

### Complete Secure Configuration / 完整安全配置参考

```yaml
# 基础配置 / Basic config
allow-lan: false          # 不允许局域网设备连接 / Disallow LAN devices
bind-address: "127.0.0.1" # 只监听本地 / Listen on localhost only

# 管理 API / Management API
external-controller: 127.0.0.1:9090  # 仅本地访问 / Local access only

# DNS 配置 / DNS config (prevent DNS leak)
dns:
  enable: true
  listen: 127.0.0.1:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 8.8.8.8      # Google DNS
    - 1.1.1.1      # Cloudflare DNS
  fallback:
    - 8.8.8.8
    - 1.1.1.1
  fallback-filter:
    geoip: true
    geoip-code: CN
```

---

## Certificate Auto-Renewal / 证书自动续期

Let's Encrypt 证书有效期 **90 天**，certbot 自动配置定时任务续期。

### 验证自动续期 / Verify auto-renewal:

```bash
# 测试续期（dry run）/ Test renewal
sudo certbot renew --dry-run
# 预期输出 / Expected: "Congratulations, all renewals succeeded."

# 查看定时任务 / Check timer
sudo systemctl list-timers | grep certbot
# 预期 / Expected: certbot.timer active

# 查看续期脚本 / Check renewal script
sudo cat /etc/cron.d/certbot
```

### 手动续期 / Manual renewal:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### 证书到期前自动续期原理 / How auto-renewal works:

certbot 安装时会自动添加定时任务：
- 每天检查证书是否在 30 天内过期
- 如果过期，自动执行 `certbot renew`
- 续期后自动 reload nginx

---

## Troubleshooting / 常见问题

### Q1: Clash 导入订阅提示 "failed to fetch remote profile"？

**排查步骤 / Troubleshooting:**

```bash
# 1. 域名是否解析 / Check DNS resolution
nslookup 你的域名 8.8.8.8

# 2. 443 端口是否通 / Check port 443
nc -zv 你的域名 443

# 3. 证书是否有效 / Check certificate
curl -sk https://你的域名 | head -3

# 4. 检查 nginx 日志 / Check nginx logs
sudo tail -20 /var/log/nginx/error.log
```

### Q2: 国内网站没有直连，还是走了代理？

**排查步骤 / Troubleshooting:**

```bash
# 1. 检查 GEOIP 规则 / Check GEOIP rule
# 确保配置中有: - GEOIP,CN,DIRECT

# 2. 检查 rule-providers 是否下载成功 / Check if rule-providers downloaded
# Clash 首次启动会自动下载 ChinaMax 规则集
# 查看日志: sudo journalctl -u shadowsocks 或 检查 /tmp/sub_server.log

# 3. 确认规则顺序 / Verify rule order
# GEOIP,CN 必须在 MATCH 之前
```

### Q3: 导入后无法上网？

**排查步骤 / Troubleshooting:**

```bash
# 1. 检查 Shadowsocks 是否运行 / Check SS status
sudo systemctl status shadowsocks
ss -tlnp | grep 8388

# 2. 检查密码和加密方式是否正确 / Check password and method
# ss://base64encoded@43.155.161.178:8388

# 3. 检查云安全组是否同时开放 TCP 和 UDP 8388
# 两者都要开放！
```

### Q4: 订阅链接需要改密码怎么办？

```bash
# 1. 修改 /tmp/sub_server.py 中的 SS_PASSWORD
sudo nano /tmp/sub_server.py

# 2. 重启订阅服务 / Restart subscription service
pkill -f sub_server.py
nohup python3 /tmp/sub_server.py > /tmp/sub_server.log 2>&1 &

# 3. 完成！用户下次更新订阅自动生效 / Done! Users auto-update on next refresh
```

### Q5: 域名解析失败？

```bash
# 1. 登录 duckdns.org 重新设置 IP
# 2. 等待 5 分钟生效
# 3. 验证 / Verify:
nslookup 你的域名 8.8.8.8
```

### Q6: 证书过期了？

```bash
# 自动续期（推荐）/ Auto-renew (recommended)
sudo certbot renew

# 手动续期 + 重载 / Manual renew + reload
sudo certbot renew && sudo systemctl reload nginx
```

### Q7: 怎样防止订阅链接被盗用？

- **定期更换 token**：`openssl rand -hex 32` 生成新 token
- **Cloudflare CDN**：隐藏真实 VPS IP，配合 CDN 使用
- **Nginx 限速**：限制单 IP 访问频率
- **订阅加密**：使用 base64 + AES 加密订阅内容（进阶）

### Q8: 如何迁移到新 VPS？

1. 在新 VPS 执行上述所有步骤
2. 修改 `VPS_IP` 为新 VPS IP
3. 重启订阅服务
4. **duckdns 域名 IP 指向新 VPS**
5. 用户下次刷新订阅自动更新

---

## Quick Reference / 快速参考

### 快速部署清单 / Quick Deploy Checklist

```bash
# 1. 注册 duckdns 域名 / Register duckdns domain
# → https://www.duckdns.org

# 2. 开放防火墙端口 / Open firewall ports
# VPS: sudo ufw allow 80,443,8388/tcp + 8388/udp
# 云控制台: 安全组添加入站规则

# 3. 安装依赖 / Install deps
sudo apt-get update && sudo apt-get install -y \
  shadowsocks-libev nginx certbot python3-certbot-nginx

# 4. 配置并启动 Shadowsocks / Configure SS
# → 参考第四步 / See Step 4

# 5. 申请证书 / Apply certificate
sudo certbot certonly --nginx -d 你的域名 --non-interactive --agree-tos --register-unsafely-without-email

# 6. 创建订阅服务 / Create subscription service
# → 参考第五步 / See Step 5

# 7. 配置 nginx / Configure nginx
# → 参考第七步 / See Step 7

# 8. 验证 / Verify
curl -sk https://你的域名/ssone/你的TOKEN | head -5
```

### 关键文件路径 / Key File Paths

| 文件 | 路径 |
|------|------|
| SS 配置 / SS config | `/etc/systemd/system/shadowsocks.service` |
| 订阅脚本 / Sub script | `/tmp/sub_server.py` |
| nginx HTTPS 配置 | `/etc/nginx/sites-available/sub_https` |
| Let's Encrypt 证书 | `/etc/letsencrypt/live/你的域名/` |
| nginx 日志 | `/var/log/nginx/access.log` |
| 订阅日志 | `/tmp/sub_server.log` |

---

## Related Resources / 相关资源

| 资源 | 链接 |
|------|------|
| Shadowsocks 官网 | https://shadowsocks.org/ |
| Let's Encrypt | https://letsencrypt.org/ |
| Clash 规则集合 (ChinaMax) | https://github.com/blackmatrix7/ios_rule_script |
| Clash Verge 下载 | https://github.com/clash-verge-rev/clash-verge-rev |
| duckdns 注册 | https://www.duckdns.org/ |
| nginx 文档 | https://nginx.org/en/docs/ |
| Certbot 文档 | https://certbot.eff.org/ |

---

*Last updated / 最后更新: 2026-07-16*
