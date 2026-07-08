#!/usr/bin/env bash
# 22 — Tune the 1GB Oracle box: 2GB swap + kernel overcommit + postgresql.conf for 1GB.
# Run on the Oracle VM as a sudo-capable user. Idempotent.
set -euo pipefail

PGCONF="${PGCONF:-/etc/postgresql/17/main/postgresql.conf}"   # adjust to your distro/path

# ── 2GB swap (prevents OOM-killer nuking postgres during restore/MV refresh) ──
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo sysctl -w vm.swappiness=10
sudo sysctl -w vm.overcommit_memory=2
sudo sysctl -w vm.overcommit_ratio=80
grep -q vm.swappiness /etc/sysctl.conf || printf 'vm.swappiness=10\nvm.overcommit_memory=2\nvm.overcommit_ratio=80\n' | sudo tee -a /etc/sysctl.conf

# ── postgresql.conf for 1GB RAM (~5–10 clients, private/low-traffic) ──────────
sudo tee -a "$PGCONF" >/dev/null <<'CONF'

# ── 1GB-RAM tuning (migration 22_ora_tune.sh) ──
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 8MB
maintenance_work_mem = 128MB
max_connections = 20
wal_buffers = 16MB
max_wal_size = 1GB
min_wal_size = 128MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
huge_pages = off
jit = off
ssl = on
CONF

# Bias the OOM-killer AWAY from postgres (drop-in systemd override).
sudo mkdir -p /etc/systemd/system/postgresql.service.d
printf '[Service]\nOOMScoreAdjust=-500\n' | sudo tee /etc/systemd/system/postgresql.service.d/oom.conf
sudo systemctl daemon-reload
echo "tuned. restart postgres:  sudo systemctl restart postgresql"
