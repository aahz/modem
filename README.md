# Modem Control Service

Node.js + TypeScript сервис для отправки AT-команд в модем с RBAC, JWT, SQLite и web UI.

## Что реализовано

- API для отправки AT-команд и получения статуса модема.
- Роли `admin` и `user`:
  - `admin` может отправлять любые AT-команды.
  - `user` ограничен whitelist-списком из `USER_ALLOWED_COMMANDS`.
- Авторизация:
  - JWT логин по username/password.
  - API токены (создание/отзыв) для интеграций.
- Аудит логов команд в SQLite.
- Web UI (`/ui`) на `React + Adobe Spectrum` для:
  - авторизации,
  - отправки AT-команд,
  - live-логов без ручного refresh,
  - управления токенами (admin).

## Локальный запуск (yarn)

1. Скопировать env:

```bash
cp .env.example .env
```

2. Установить зависимости:

```bash
yarn install
```

3. Запустить dev-сервер:

```bash
yarn dev
```

Сервис поднимется на `http://localhost:8080`, UI: `http://localhost:8080/ui`.

Для разработки UI отдельно:

```bash
yarn dev:ui
```

## Docker Compose

1. Подготовить `.env` и указать `MODEM_DEVICE` (например `/dev/ttyUSB0`):

```env
MODEM_DEVICE=/dev/ttyUSB0
JWT_SECRET=super-secret
ADMIN_BOOTSTRAP_USERNAME=admin
LOG_RETENTION_DAYS=30
# Optional: if omitted, temporary password is generated and printed once in logs.
# ADMIN_BOOTSTRAP_PASSWORD=strong-password
```

2. Запуск:

```bash
docker compose up -d --build
```

## Удаленная разработка (сервер с модемом)

Для dev-цикла с hot-reload лучше запускать `docker compose` прямо на удаленном сервере, где физически подключен модем.
В dev-конфиге поднимаются 2 сервиса:
- `modem` (API, порт `8086`)
- `modem-ui` (Vite UI, порт `5173`, proxy в API контейнер)

1. На сервере `192.168.88.2`:
- клонировать репозиторий;
- создать `.env` (или `env_file`) с `MODEM_DEVICE`, `JWT_SECRET` и т.д.

2. Запуск dev-сборки:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

3. Логи:

```bash
docker compose -f docker-compose.dev.yml logs -f modem modem-ui
```

4. Открыть:
- UI: `http://<server-ip>:5173/ui/`
- API health: `http://<server-ip>:8086/health`

5. Остановка:

```bash
docker compose -f docker-compose.dev.yml down
```

Если хочешь запускать команды с локальной машины, можно использовать `docker context`:

```bash
docker context create modem-remote --docker "host=ssh://USER@192.168.88.2"
docker --context modem-remote ps
```

Важно: для dev-файла используются bind-mount (`./:/app`), поэтому проект должен быть на файловой системе удаленного сервера; с remote daemon bind-монты читаются на стороне сервера, а не локального компьютера.

## Добавление в общий docker-compose

Если у вас уже есть общий `docker-compose.yml`, добавьте сервис `modem` в секцию `services`:

```yaml
services:
  modem:
    image: ghcr.io/aahz/modem:latest
    build:
      context: ./modem
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - /opt/modem/.env
    environment:
      NODE_ENV: production
      PORT: 8080
      DB_PATH: /app/data/modem.sqlite
      JWT_SECRET: ${JWT_SECRET}
      MODEM_DEVICE: /dev/ttyACM0
      BAUD_RATE: ${BAUD_RATE:-9600}
      USER_ALLOWED_COMMANDS: ${USER_ALLOWED_COMMANDS:-AT,ATI,AT+CSQ}
      ADMIN_BOOTSTRAP_USERNAME: ${ADMIN_BOOTSTRAP_USERNAME:-root}
      ADMIN_BOOTSTRAP_PASSWORD: ${ADMIN_BOOTSTRAP_PASSWORD}
    volumes:
      - ./modem/data:/app/data
    devices:
      - "${MODEM_DEVICE:-/dev/ttyACM0}:${SERIAL_PATH:-/dev/ttyACM0}"
    networks:
      - modem-network

networks:
  modem-network:
    driver: bridge
```

Ключевые моменты:
- `context: ./modem` должен указывать на папку проекта этого сервиса.
- Да, можно читать env с машины, где деплой:
  - глобально через `.env` рядом с `docker-compose.yml`;
  - или явно через `env_file` (как в примере: `/opt/stack/env/modem.env`).
- `devices` обязателен для доступа к USB-модему из контейнера.
- `./modem/data` (или ваш volume) нужен для сохранения SQLite между рестартами.
- Если сервис не должен быть доступен снаружи, не публикуйте `ports`, используйте только внутреннюю сеть и reverse proxy.

## API (основное)

- OpenAPI JSON: `/openapi.json`
- Swagger UI: `/docs`

- `POST /api/v1/auth/login`:
  - body: `{ "username": "admin", "password": "..." }`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`:
  - body: `{ "currentPassword": "...", "newPassword": "..." }`
- `POST /api/v1/at/send`:
  - body: `{ "command": "AT+CSQ", "timeoutMs": 5000 }`
- `GET /api/v1/modem/status`
- `GET /api/v1/logs?limit=100`
- `GET /api/v1/logs/stream?token=<jwt_or_api_token>` (SSE live stream)
- `GET /api/v1/tokens` (admin)
- `POST /api/v1/tokens` (admin)
- `POST /api/v1/tokens/:id/revoke` (admin)
- `POST /api/v1/users` (admin)

Все защищенные endpoint'ы требуют `Authorization: Bearer <token>`.

## Сборка image через GitHub Actions

Настроен workflow: `.github/workflows/docker-image.yml`.

- При push в `master` публикуются теги:
  - `ghcr.io/aahz/modem:latest`
  - `ghcr.io/aahz/modem:sha-<commit>`
- При push в `unstable` публикуется только:
  - `ghcr.io/aahz/modem:unstable`
- При push тега `vX.Y.Z` (например после `yarn version`) публикуются:
  - `ghcr.io/aahz/modem:X.Y.Z`
  - `ghcr.io/aahz/modem:X.Y`
  - `ghcr.io/aahz/modem:X`

Релиз конкретной версии через `yarn version`:

```bash
yarn version --patch
git push origin master --follow-tags
```

Для `minor`/`major`:

```bash
yarn version --minor
yarn version --major
```

Пример pull:

```bash
docker pull ghcr.io/aahz/modem:latest
docker pull ghcr.io/aahz/modem:unstable
docker pull ghcr.io/aahz/modem:1.2.3
```

## Примечания по безопасности

- Никогда не оставляйте дефолтный `JWT_SECRET` и пароль bootstrap-админа.
- Для bootstrap-админа включена обязательная смена пароля при первом входе.
- Для `user`-роли используйте максимально строгий whitelist в `USER_ALLOWED_COMMANDS`.
- Логи AT-команд автоматически очищаются по `LOG_RETENTION_DAYS` (по умолчанию 30 дней).
- Для продакшена лучше вынести TLS/ingress перед сервисом и ограничить сетью доступ к API/UI.
