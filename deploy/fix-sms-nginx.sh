#!/usr/bin/env bash
set -euo pipefail

# Update sms.simble.unscale.cloud vhost to route /api/* to textbee-api (host:3010)
# and everything else to textbee-web (host:3000)
# textbee-web is also on the internal docker network, so we use the docker network
# But for simplicity, also expose textbee-web to host:3000 (collides with Karakeep so
# use a different host port: 3020)

VHOST=/etc/nginx/sites-enabled/sms.simble.unscale.cloud

cat > "$VHOST" <<'EOF'
# textbee stack
server {
    server_name sms.simble.unscale.cloud;

    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/simble.unscale.cloud/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/simble.unscale.cloud/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = sms.simble.unscale.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name sms.simble.unscale.cloud;
    return 404; # managed by Certbot
}
EOF

echo "--- updated vhost ---"
cat "$VHOST"
echo "--- testing nginx ---"
nginx -t 2>&1
echo "--- reloading ---"
systemctl reload nginx 2>&1
echo "--- done ---"
