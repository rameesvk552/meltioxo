#!/usr/bin/env bash
set -euo pipefail

APP=/mnt/recovery/perfume-erp/app
INCOMING=/mnt/recovery/perfume-erp/incoming
ENV_BACKUP=$(mktemp)

if [ -f "$APP/server/.env" ]; then
  cp "$APP/server/.env" "$ENV_BACKUP"
fi

rm -rf "$APP/client" "$APP/server"
tar -xzf "$INCOMING/perfume-erp-release.tgz" -C "$APP"
tar -xzf "$INCOMING/perfume-erp-server-node_modules.tgz" -C "$APP"

if [ -s "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$APP/server/.env"
fi
rm -f "$ENV_BACKUP"

if ! sudo docker inspect perfume-erp-db >/dev/null 2>&1; then
  DB_PASSWORD=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 48)

  sudo docker run -d \
    --name perfume-erp-db \
    --restart unless-stopped \
    -e POSTGRES_USER=perfume_erp \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=perfume_erp \
    -p 127.0.0.1:5432:5432 \
    -v /mnt/recovery/perfume-erp/postgres-data:/var/lib/postgresql/data \
    postgres:17-alpine >/dev/null

  printf 'PORT=5001\nNODE_ENV=production\nDB_HOST=127.0.0.1\nDB_USER=perfume_erp\nDB_PASSWORD=%s\nDB_NAME=perfume_erp\nJWT_SECRET=%s\n' "$DB_PASSWORD" "$JWT_SECRET" > "$APP/server/.env"
fi

until sudo docker exec perfume-erp-db pg_isready -U perfume_erp -d perfume_erp >/dev/null 2>&1; do
  sleep 2
done

test -f "$APP/server/.env"
pm2 delete perfume-erp-api >/dev/null 2>&1 || true
pm2 start server.js --name perfume-erp-api --cwd "$APP/server"
pm2 save

sudo install -m 644 "$INCOMING/perfume.wayon.in.conf" /etc/nginx/conf.d/perfume.wayon.in.conf
sudo nginx -t
sudo systemctl reload nginx

for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:5001/health; then
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:5001/health
curl -fsSI -H 'Host: perfume.wayon.in' http://127.0.0.1/ | head -1
