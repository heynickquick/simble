#!/usr/bin/env bash
set -euo pipefail

# Idempotent: set up nginx vhost for simble.unscale.cloud
# - Creates HTTP vhost (proxy to web:8080)
# - Creates stub HTTPS server (certbot will fill in cert later)
# - Does NOT run certbot — run it manually once DNS resolves

DOMAIN="${1:-simble.unscale.cloud}"
VHOST="/etc/nginx/sites-available/${DOMAIN}"
ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

# SMS subdomain: only create the vhost, textbee may not be running yet
SMS_DOMAIN="sms.${DOMAIN}"
SMS_VHOST="/etc/nginx/sites-available/${SMS_DOMAIN}"
SMS_ENABLED="/etc/nginx/sites-enabled/${SMS_DOMAIN}"

# Simble stack
cat > "$VHOST" <<EOF
# Simble stack
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:8880;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# SMS / textbee stack (textbee may not be running yet — that's fine, just configures the vhost)
cat > "$SMS_VHOST" <<EOF
# textbee stack
server {
    listen 80;
    listen [::]:80;
    server_name ${SMS_DOMAIN};

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable
ln -sf "$VHOST" "$ENABLED"
ln -sf "$SMS_VHOST" "$SMS_ENABLED"

echo "--- Testing nginx config ---"
nginx -t 2>&1

echo "--- Reloading nginx ---"
systemctl reload nginx 2>&1

echo ""
echo "✅ Vhosts created:"
echo "  http://${DOMAIN}/        → simble web UI (port 8880)"
echo "  http://${DOMAIN}/api/    → campaign-manager (port 4000)"
echo "  http://${SMS_DOMAIN}/    → textbee (port 3000, when running)"
echo ""
echo "Next step: add DNS A records pointing to this VPS IP, then run certbot:"
echo "  sudo certbot --nginx -d ${DOMAIN} -d ${SMS_DOMAIN}"
