#!/usr/bin/env bash
set -euo pipefail

# Idempotent VPS setup for simble
# - Ubuntu 24.04 LTS
# - Non-root deploy user with sudo
# - SSH key only, fail2ban, UFW
# - Docker + docker-compose plugin
# - Useful tools
#
# Run as root: bash setup-vps.sh
# Or: DEPLOY_USER=alice bash setup-vps.sh

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

if [[ $EUID -ne 0 ]]; then
    echo "Run as root: sudo bash setup-vps.sh"
    exit 1
fi

echo "==> Updating system"
apt update && apt upgrade -y

echo "==> Installing base packages"
apt install -y \
    ufw fail2ban unattended-upgrades \
    curl wget git jq htop vim nano ncdu \
    ca-certificates gnupg lsb-release \
    apt-transport-https software-properties-common \
    rsync

echo "==> Setting timezone to America/New_York"
timedatectl set-timezone America/New_York || true

echo "==> Creating deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    if [[ -f /root/.ssh/authorized_keys ]]; then
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/authorized_keys
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
        chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    fi
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
    chmod 440 /etc/sudoers.d/$DEPLOY_USER
fi

echo "==> Hardening SSH"
SSHD_CONF=/etc/ssh/sshd_config
cp "$SSHD_CONF" "${SSHD_CONF}.bak.$(date +%s)"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONF"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONF"
sed -i "s/^#\?Port.*/Port $SSH_PORT/" "$SSHD_CONF"

echo "==> Configuring UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Configuring fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
EOF
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> Enabling unattended-upgrades"
dpkg-reconfigure -plow unattended-upgrades <<< "yes" || true

echo "==> Installing Docker"
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os/release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker "$DEPLOY_USER"
fi

echo "==> Restarting SSH"
systemctl restart sshd

echo ""
echo "============================================"
echo "  VPS setup complete"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Test SSH as deploy user from a new terminal:"
echo "     ssh $DEPLOY_USER@<this-ip> -p $SSH_PORT"
echo "  2. Verify Docker works for deploy user:"
echo "     docker run hello-world"
echo "  3. Clone simble repo and run deploy/first-deploy.sh"
echo ""
echo "WARNING: if you ran this over SSH as $DEPLOY_USER,"
echo "you will be disconnected. Reconnect as $DEPLOY_USER@<this-ip>."
