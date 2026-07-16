---
name: vps-clash-subscription
description: 在腾讯云VPS上搭建Clash订阅服务，支持HTTPS订阅、Let's Encrypt证书、国内网站直连规则
triggers:
  - 在VPS上搭建VPN订阅服务
  - 搭建clash订阅
  - 配置Clash规则
---

# VPS Clash 订阅服务搭建

## 架构概览

```
Clash客户端 → [HTTPS] → nginx → [HTTP] → Python订阅服务 → Shadowsocks代理
                                   ↓
                              Clash YAML配置
                                   ↓
                              ChinaMax规则集 (12万+条)
```

## 前置要求

- VPS: Ubuntu 24.04，公网IP已知
- 腾讯云安全组开放端口: 80, 443, 8388(TCP+UDP), 65534
- 域名: duckdns.org 免费域名（指向VPS IP）
- GitHub账号（用于上传skill）

## 部署步骤

### 1. 安装依赖

```bash
# 安装Docker（用于Shadowsocks）
apt-get install -y docker.io

# 安装nginx + Let's Encrypt
apt-get install -y nginx certbot python3-certbot-nginx

# 安装gh CLI（用于上传skill）
curl -sL https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.tar.gz | tar -xz -C /tmp
sudo mv /tmp/gh_2.63.2_linux_amd64/bin/gh /usr/local/bin/
```

### 2. 安装Shadowsocks

```bash
apt-get install -y shadowsocks-libev
```

创建systemd服务 `/etc/systemd/system/shadowsocks.service`:
```ini
[Unit]
Description=Shadowsocks Libev Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/ss-server -s 0.0.0.0 -p 8388 -k YOUR_PASSWORD -m chacha20-ietf-poly1305 -u
Restart=on-abort

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable shadowsocks
sudo systemctl start shadowsocks
```

### 3. 注册duckdns域名

1. 访问 https://www.duckdns.org
2. 用Google/GitHub登录
3. 创建子域名指向VPS公网IP
4. 记录域名（如 `yourname.duckdns.org`）

### 4. 申请Let's Encrypt证书

```bash
sudo certbot certonly --nginx -d YOUR_DOMAIN --non-interactive --agree-tos --register-unsafely-without-email
```

证书路径: `/etc/letsencrypt/live/YOUR_DOMAIN/`

### 5. 创建订阅服务

创建 `/tmp/sub_server.py`:

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
    server: YOUR_VPS_IP
    port: 8388
    cipher: chacha20-ietf-poly1305
    password: YOUR_PASSWORD
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

NEW_TOKEN = "GENERATE_WITH_openssl rand -hex 32"

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

后台运行:
```bash
nohup python3 /tmp/sub_server.py > /tmp/sub_server.log 2>&1 &
```

### 6. 配置nginx HTTPS反代

创建 `/etc/nginx/sites-available/sub_https`:
```nginx
server {
    listen 443 ssl;
    server_name YOUR_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /ssone/YOUR_TOKEN {
        proxy_pass http://127.0.0.1:65534/ssone/YOUR_TOKEN;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用并重载:
```bash
sudo ln -sf /etc/nginx/sites-available/sub_https /etc/nginx/sites-enabled/sub_https
sudo nginx -t && sudo nginx -s reload
```

### 7. 腾讯云安全组规则

| 协议 | 端口 | 来源 |
|------|------|------|
| TCP | 80 | 0.0.0.0/0 |
| TCP | 443 | 0.0.0.0/0 |
| TCP | 8388 | 0.0.0.0/0 |
| UDP | 8388 | 0.0.0.0/0 |
| TCP | 65534 | 0.0.0.0/0 |

## 最终订阅链接

```
https://YOUR_DOMAIN/ssone/YOUR_TOKEN
```

## 安全配置

- `allow-lan: false` — 禁止局域网访问
- `bind-address: "127.0.0.1"` — 只监听本地
- `external-controller: 127.0.0.1:9090` — 管理API本地访问
- DNS: 8.8.8.8 / 1.1.1.1 — 不走国内DNS
- Let's Encrypt 正式证书 — HTTPS可信
- 订阅路径32位随机token — 防猜测

## 常见问题

**Q: Clash导入订阅提示证书错误？**
A: 使用Let's Encrypt证书后不会出现此问题，之前版本用自签证书才需要忽略警告。

**Q: 国内网站没有直连？**
A: 检查GEOIP,CN规则和rule-providers中的ChinaMax规则集是否下载成功。

**Q: 订阅链接404？**
A: 检查nginx反代配置中的token是否与Python服务中的token一致。

## 上传Skill到GitHub

```bash
gh auth login --with-token YOUR_GH_TOKEN
gh repo clone minigoubai/yaoyao_gm
cd yaoyao_gm
mkdir -p skills/vps-clash-subscription
# 复制SKILL.md到skills/vps-clash-subscription/
gh workflow run skill-curator.yml  # 或手动push
```
