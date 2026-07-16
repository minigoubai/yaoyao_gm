---
name: vps-clash-subscription
description: 在腾讯云VPS上搭建完整的Clash订阅服务 — 包含HTTPS证书、域名配置、安全策略、国内分流规则、自动续期
triggers:
  - 在VPS上搭建VPN订阅服务
  - 搭建clash订阅
  - VPS科学上网
  - 自建订阅节点
  - Let's Encrypt证书配置
---

# VPS Clash 订阅服务搭建完整指南

## 目录

1. [架构说明](#架构说明)
2. [前置要求](#前置要求)
3. [端口规划](#端口规划)
4. [安全配置](#安全配置)
5. [部署步骤](#部署步骤)
   - [第一步：注册域名](#第一步注册域名)
   - [第二步：开放腾讯云端口](#第二步开放腾讯云端口)
   - [第三步：安装依赖](#第三步安装依赖)
   - [第四步：安装Shadowsocks](#第四步安装shadowsocks)
   - [第五步：配置订阅服务](#第五步配置订阅服务)
   - [第六步：申请Let's Encrypt证书](#第六步申请lets-encrypt证书)
   - [第七步：配置nginx HTTPS反代](#第七步配置nginx-https反代)
   - [第八步：验证服务](#第八步验证服务)
6. [Clash客户端配置](#clash客户端配置)
7. [安全详解](#安全详解)
8. [证书自动续期](#证书自动续期)
9. [常见问题](#常见问题)

---

## 架构说明

```
┌─────────────────┐     HTTPS (443)      ┌──────────────────┐    HTTP (65534)    ┌────────────────┐
│  Clash 客户端    │ ──────────────────→  │     nginx        │ ────────────────→  │  Python订阅服务 │
│  (Clash Verge)  │   正式证书(TLS)      │  反向代理+TLS终止 │                    │  (本地127.0.0.1) │
└─────────────────┘                      └──────────────────┘                    └───────┬────────┘
                                                                                         │
                                                                                         ↓
                                                                          ┌────────────────────────┐
                                                                          │   Clash YAML 配置       │
                                                                          │   - 代理节点信息        │
                                                                          │   - 分流规则            │
                                                                          │   - rule-providers     │
                                                                          └────────────────────────┘

┌─────────────────┐     SS加密 (8388)     ┌──────────────────┐
│  Clash 客户端    │ ←───────────────────  │  Shadowsocks     │ ←─── 互联网
│  (实际流量)      │    TCP+UDP           │  ss-server       │       目标网站
└─────────────────┘                       └──────────────────┘
```

**关键点：**
- HTTPS 只用于订阅配置文件下载（一次性）
- 实际代理流量走 Shadowsocks 直连，不经过 nginx
- nginx 终止 TLS，Python 订阅服务只需监听本地 HTTP

---

## 前置要求

- **VPS**: Ubuntu 24.04（其他 Linux 也可，命令略有不同）
- **公网IP**: 已知，例如 `43.155.161.178`
- **域名**: duckdns.org 免费域名（指向 VPS IP）
- **腾讯云安全组**: 可在云控制台配置入站规则
- **Clash客户端**: Clash Verge / Clash for Windows / ClashX

---

## 端口规划

| 端口 | 协议 | 用途 | 是否暴露公网 |
|------|------|------|-------------|
| 80   | TCP  | Let's Encrypt 证书申请（临开） | 是 |
| 443  | TCP  | HTTPS 订阅访问 | 是 |
| 8388 | TCP+UDP | Shadowsocks 代理端口 | 是 |
| 65534 | TCP | Python 订阅服务（仅本地） | 否（nginx反代） |
| 9090 | TCP  | Clash 管理API（仅本地） | 否 |

---

## 安全配置

### 为什么需要这些安全措施？

| 配置项 | 危险后果（如果不设）|
|--------|-------------------|
| `allow-lan: false` | 全球任何人都能通过你的 VPS 代理流量 |
| `bind-address: "127.0.0.1"` | 代理端口监听公网，任何人可直连 |
| `external-controller: 127.0.0.1` | 任何人可远程控制你的 Clash 配置 |
| DNS 使用 8.8.8.8/1.1.1.1 | DNS 查询经过国内服务器，隐私泄露 |
| Let's Encrypt 证书 | 自签证书密码明文传输，MITM 风险 |
| 订阅路径 32 位随机 token | 路径被猜测，配置泄露 |

### 推荐的密码规范

```bash
# 生成强密码
openssl rand -base64 32
# 示例: YmVvcmT5c2VjcmV0a2V5ISEhMzIuLi4=
```

---

## 部署步骤

### 第一步：注册域名

**为什么需要域名？**
- Let's Encrypt 不支持纯 IP 签发证书
- duckdns.org 提供免费子域名，5 分钟搞定

**操作步骤：**

1. 访问 https://www.duckdns.org
2. 点击页面顶部用 **GitHub 或 Google** 登录
3. 点击 "Create your domain"
4. 输入子域名（如 `yaoyaogm`），系统自动生成 `yaoyaogm.duckdns.org`
5. 在 IPV4 输入框填入你的 VPS 公网 IP（如 `43.155.161.178`）
6. 点击 "save" 保存

**验证域名解析：**
```bash
nslookup yaoyaogm.duckdns.org 8.8.8.8
# 应返回: Address: 43.155.161.178
```

> ⚠️ duckdns 免费域名有效期无限，但 30 天不登录会删除，建议收藏保存。

---

### 第二步：开放腾讯云端口

**必须去腾讯云控制台手动添加**，不是 Linux 防火墙！

**操作路径：**
云服务器 CVM → 点击你的机器 → **安全组** → 入站规则 → 添加规则

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 80 | 0.0.0.0/0 | 证书申请临时开放 |
| TCP | 443 | 0.0.0.0/0 | HTTPS 订阅访问 |
| TCP | 8388 | 0.0.0.0/0 | SS 代理 TCP |
| UDP | 8388 | 0.0.0.0/0 | SS 代理 UDP |
| TCP | 65534 | 0.0.0.0/0 | Python 订阅服务 |

> ⚠️ 开放后告诉智能体验证端口是否通。

---

### 第三步：安装依赖

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装 shadowsocks-libev（轻量，比 Docker 版更简单）
sudo apt-get install -y shadowsocks-libev

# 安装 nginx + Let's Encrypt 证书工具
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 验证安装
ss-server --version    # 应显示版本号
nginx -v               # 应显示 nginx 版本
certbot --version      # 应显示 certbot 版本
```

---

### 第四步：安装Shadowsocks

**创建 systemd 服务文件：**
```bash
sudo nano /etc/systemd/system/shadowsocks.service
```

内容：
```ini
[Unit]
Description=Shadowsocks Libev Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/ss-server -s 0.0.0.0 -p 8388 -k 你的密码 -m chacha20-ietf-poly1305 -u
Restart=on-abort
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**启动并设置开机自启：**
```bash
sudo systemctl daemon-reload
sudo systemctl enable shadowsocks
sudo systemctl start shadowsocks

# 验证运行状态
sudo systemctl status shadowsocks
ss -tlnp | grep 8388   # 应显示 0.0.0.0:8388 LISTEN
```

**加密方式说明：**
- `chacha20-ietf-poly1305` — 推荐，抗审查，性能好
- `aes-256-gcm` — 也支持，但部分设备性能较弱
- 不推荐 `rc4-md5`，已被破解

---

### 第五步：配置订阅服务

**生成安全的订阅路径 token：**
```bash
openssl rand -hex 32
# 示例输出: 819aa2e8bbf0e8df81325b8f14c8d919532feff1fb56b5aa55de45e77016ca58
```

**创建订阅服务脚本：**
```bash
sudo nano /tmp/sub_server.py
```

内容：
```python
#!/usr/bin/env python3
import http.server
import socketserver

CLASH_YAML = """port: 7890
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

proxies:
  - name: "VPS-SS"
    type: ss
    server: 你的VPS公网IP
    port: 8388
    cipher: chacha20-ietf-poly1305
    password: 你的密码
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
  - DOMAIN-SUFFIX,cn,DIRECT
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,tmall.com,DIRECT
  - DOMAIN-SUFFIX,jd.com,DIRECT
  - DOMAIN-SUFFIX,alipay.com,DIRECT
  - DOMAIN-SUFFIX,aliyun.com,DIRECT
  - DOMAIN-SUFFIX,163.com,DIRECT
  - DOMAIN-SUFFIX,youku.com,DIRECT
  - DOMAIN-SUFFIX,iqiyi.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT
  - DOMAIN-SUFFIX,douyin.com,DIRECT
  - DOMAIN-SUFFIX,tencent.com,DIRECT
  - DOMAIN-SUFFIX,weixin.com,DIRECT
  - DOMAIN-SUFFIX,meituan.com,DIRECT
  - DOMAIN-SUFFIX,zhihu.com,DIRECT
  - DOMAIN-SUFFIX,csdn.net,DIRECT
  - DOMAIN-SUFFIX,gov.cn,DIRECT
  - DOMAIN-SUFFIX,10086.cn,DIRECT
  - DOMAIN-SUFFIX,189.cn,DIRECT
  - DOMAIN-SUFFIX,10010.com,DIRECT
  - DOMAIN-SUFFIX,alicdn.com,DIRECT
  - DOMAIN-SUFFIX,dingtalk.com,DIRECT
  - DOMAIN-SUFFIX,ele.me,DIRECT
  - DOMAIN-SUFFIX,pinduoduo.com,DIRECT
  - DOMAIN-SUFFIX,suning.com,DIRECT
  - DOMAIN-KEYWORD,cn,DIRECT
  - DOMAIN-KEYWORD,baidu,DIRECT
  - DOMAIN-KEYWORD,alibaba,DIRECT
  - DOMAIN-KEYWORD,tencent,DIRECT
  - DOMAIN-KEYWORD,bytedance,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - RULE-SET,chinamax,DIRECT
  - GEOIP,CN,DIRECT
  - MATCH,Auto
"""

# ⚠️ 将下面这行替换为上面生成的 token
NEW_TOKEN = "上面openssl生成的32位hex"

class SubHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/ssone/" + NEW_TOKEN):
            config = CLASH_YAML
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", len(config))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Subscription-Userinfo", "upload=0; download=0; total=107374182400000; expire=4102444800")
            self.end_headers()
            self.wfile.write(config.encode())
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        print(f"[订阅] {args[0]}")

PORT = 65534
socketserver.TCPServer.allow_reuse_address = True
server = socketserver.TCPServer(("0.0.0.0", PORT), SubHandler)
print(f"订阅服务启动: http://0.0.0.0:{PORT}/ssone/{NEW_TOKEN}")
server.serve_forever()
```

**启动订阅服务：**
```bash
# 后台运行
nohup python3 /tmp/sub_server.py > /tmp/sub_server.log 2>&1 &

# 验证
sleep 2 && ss -tlnp | grep 65534
# 应显示: 0.0.0.0:65534 LISTEN
```

---

### 第六步：申请Let's Encrypt证书

**为什么需要 Let's Encrypt？**

| 证书类型 | 优点 | 缺点 |
|----------|------|------|
| 自签证书 | 快速 | Clash 每次导入都要点"忽略警告"，且密码明文传输有MITM风险 |
| Let's Encrypt | 正式CA签发，浏览器/Clash信任，90天自动续期 | 需要域名，需要80端口验证 |

**申请命令：**
```bash
sudo certbot certonly --nginx \
  -d 你的duckdns域名 \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email
```

**成功输出示例：**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/你的域名/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/你的域名/privkey.pem
This certificate expires on 2026-10-13.
```

**证书文件说明：**
- `fullchain.pem` — 包含完整证书链，nginx 使用这个
- `privkey.pem` — 私钥，切勿泄露

---

### 第七步：配置nginx HTTPS反代

**创建 nginx 配置：**
```bash
sudo nano /etc/nginx/sites-available/sub_https
```

内容：
```nginx
server {
    listen 443 ssl;
    server_name 你的duckdns域名;

    # Let's Encrypt 证书路径
    ssl_certificate /etc/letsencrypt/live/你的duckdns域名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的duckdns域名/privkey.pem;

    # TLS 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # 订阅路径（token 替换为你的）
    location /ssone/你的TOKEN {
        proxy_pass http://127.0.0.1:65534/ssone/你的TOKEN;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**启用配置：**
```bash
# 删除默认配置（防止冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 启用我们的配置
sudo ln -sf /etc/nginx/sites-available/sub_https /etc/nginx/sites-enabled/sub_https

# 测试配置语法
sudo nginx -t

# 重载 nginx
sudo nginx -s reload
```

---

### 第八步：验证服务

**测试订阅链接（本地）：**
```bash
curl -sk https://127.0.0.1/ssone/你的TOKEN | head -10
# 应返回 Clash YAML 配置内容
```

**测试订阅链接（公网）：**
```bash
curl -sk https://你的域名/ssone/你的TOKEN | head -10
# 应返回相同内容
```

**测试证书：**
```bash
echo | openssl s_client -connect 你的域名:443 -servername 你的域名 2>/dev/null | openssl x509 -no_out -issuer -dates
# 应显示: issuer=Let's Encrypt, notBefore/notAfter 日期
```

---

## Clash客户端配置

**订阅链接格式：**
```
https://你的域名/ssone/你的TOKEN
```

**Clash Verge 导入步骤：**

1. 点击左侧菜单 **Settings** → **Clash Core** → 选择 **Clash Verge**
2. 点击左侧 **Profiles**
3. 点击 **New Profile** → 选择 **URL**
4. 在 URL 栏填入上面的订阅链接
5. 点击 **Subscribe**
6. 首次会提示证书警告（如果是自签证书），点击"仍然连接"
7. 选择 `Auto` 节点，点击 **Set as System Proxy**

---

## 安全详解

### 订阅链路安全

```
Clash客户端
    ↓ HTTPS（TLS加密，防窃听）
nginx (TLS终止)
    ↓ HTTP（本地回环，防泄露）
Python订阅服务
    ↓
Clash YAML配置（含加密密码）
```

**为什么这样安全？**
- HTTPS 防止订阅内容在传输中被窃听
- nginx 监听 0.0.0.0:443 但 Python 只监听 127.0.0.1:65534
- 外部无法直接访问 Python 服务，只能通过 nginx 反代
- 32位随机 token 防止订阅路径被猜测

### 代理流量安全

```
Clash客户端
    ↓ SS协议加密（AES/chacha20）
Shadowsocks Server (VPS)
    ↓ 解密后直连目标
互联网
```

**密码强度建议：**
- 至少 16 位
- 使用随机字符（数字+字母+特殊字符）
- 定期更换

### 推荐的完整安全配置

```yaml
# 代理基础配置
allow-lan: false          # 不允许局域网设备连接
bind-address: "127.0.0.1" # 只监听本地

# 管理API（仅本地访问）
external-controller: 127.0.0.1:9090

# DNS配置（防止DNS泄露）
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

## 证书自动续期

Let's Encrypt 证书有效期 90 天，certbot 会自动创建定时任务续期。

**验证自动续期已配置：**
```bash
sudo certbot renew --dry-run
# 应显示: "Congratulations, all renewals succeeded."
```

**查看定时任务：**
```bash
sudo systemctl list-timers | grep certbot
# 应显示: certbot.timer active
```

**手动续期（如果快过期）：**
```bash
sudo certbot renew
sudo nginx -s reload
```

---

## 常见问题

**Q1: Clash 导入订阅提示"failed to fetch remote profile"？**
A: 检查：
- 域名是否解析正确：`nslookup 你的域名 8.8.8.8`
- 443 端口是否开放：云安全组 + `nc -zv 你的域名 443`
- 证书是否生效：`curl -sk https://你的域名 | head -3`

**Q2: 国内网站没有直连，还是走了代理？**
A: 检查：
- `GEOIP,CN,DIRECT` 规则是否存在
- `rule-providers` 中的 ChinaMax 规则是否下载成功（Clash 首次启动会自动下载）
- 规则匹配是按顺序的，确保 `GEOIP,CN` 在 `MATCH` 之前

**Q3: 导入后无法上网？**
A: 检查：
- 腾讯云安全组是否同时开放了 TCP 和 UDP 8388
- Shadowsocks 是否在运行：`sudo systemctl status shadowsocks`
- 密码和加密方式是否与配置一致

**Q4: 订阅链接需要改密码怎么办？**
A:
1. 修改 `/tmp/sub_server.py` 中的密码
2. 重启 Python 订阅服务：`pkill -f sub_server.py && nohup python3 /tmp/sub_server.py &`
3. 完成，不需要通知用户重新导入（下次更新时才需要）

**Q5: 域名解析不到 VPS 了怎么办？**
A:
1. 登录 duckdns.org 重新设置 IP
2. 等待 5 分钟生效
3. 如果长期不用可以考虑用 noip.com 或花瓣出国 等其他免费域名

**Q6: 证书过期了怎么办？**
A:
```bash
sudo certbot renew
sudo nginx -s reload
```

**Q7: 怎样防止订阅链接被盗用？**
A:
- 定期更换 token（`openssl rand -hex 32`）
- 配合 Cloudflare CDN 使用（隐藏真实 IP）
- 使用 Nginx 限制单 IP 访问频率

---

## 快速复现清单

如果你在新的 VPS 上重新部署，按这个顺序执行：

- [ ] 注册 duckdns.org 域名
- [ ] 腾讯云安全组开放 80, 443, 8388(TCP+UDP)
- [ ] `apt-get install -y shadowsocks-libev nginx certbot python3-certbot-nginx`
- [ ] 配置并启动 shadowsocks 服务
- [ ] 注册 duckdns 域名并确认解析
- [ ] `certbot certonly --nginx -d 你的域名`
- [ ] 创建并启动 Python 订阅服务
- [ ] 配置 nginx HTTPS 反代
- [ ] 验证订阅链接可访问
- [ ] Clash 客户端导入订阅

---

## 相关资源

- [Shadowsocks-libev 文档](https://shadowsocks.org/)
- [Let's Encrypt 官方](https://letsencrypt.org/)
- [Clash 规则集合](https://github.com/blackmatrix7/ios_rule_script)
- [Clash Verge 下载](https://github.com/clash-verge-rev/clash-verge-rev)
- [duckdns 注册](https://www.duckdns.org/)
