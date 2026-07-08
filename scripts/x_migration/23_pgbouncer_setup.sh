#!/usr/bin/env bash
# 23 — Install PgBouncer in TRANSACTION mode on :6432 (localhost, ~5MB RAM).
# App pools (dashboard_server/finance_api on Vercel Fluid) go through :6432 so
# many serverless instances don't exhaust max_connections=20 on the 1GB box.
# stock_collector does NOT use this — it needs session/direct :5432
# (-c timezone=UTC + prepare_threshold=None are incompatible with txn pooling).
set -euo pipefail

sudo apt-get install -y pgbouncer   # or dnf, per distro

sudo tee /etc/pgbouncer/pgbouncer.ini >/dev/null <<'INI'
[databases]
finance = host=127.0.0.1 port=5432 dbname=finance

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
default_pool_size = 15
max_client_conn = 100
server_tls_sslmode = disable
INI

echo '"app" "SCRAM_OR_MD5_HASH_HERE"' | sudo tee /etc/pgbouncer/userlist.txt
sudo systemctl enable --now pgbouncer
echo "pgbouncer up on :6432 (transaction mode). Point POSTGRES_URL here."
