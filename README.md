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
- Web UI (`/ui`) для:
  - авторизации,
  - отправки AT-команд,
  - просмотра логов,
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

## Docker Compose

1. Подготовить `.env` и указать `MODEM_DEVICE` (например `/dev/ttyUSB0`):

```env
MODEM_DEVICE=/dev/ttyUSB0
JWT_SECRET=super-secret
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=strong-password
```

2. Запуск:

```bash
docker compose up -d --build
```

## API (основное)

- `POST /api/v1/auth/login`:
  - body: `{ "username": "admin", "password": "..." }`
- `GET /api/v1/auth/me`
- `POST /api/v1/at/send`:
  - body: `{ "command": "AT+CSQ", "timeoutMs": 5000 }`
- `GET /api/v1/modem/status`
- `GET /api/v1/logs?limit=100`
- `GET /api/v1/tokens` (admin)
- `POST /api/v1/tokens` (admin)
- `POST /api/v1/tokens/:id/revoke` (admin)
- `POST /api/v1/users` (admin)

Все защищенные endpoint'ы требуют `Authorization: Bearer <token>`.

## Примечания по безопасности

- Никогда не оставляйте дефолтный `JWT_SECRET` и пароль bootstrap-админа.
- Для `user`-роли используйте максимально строгий whitelist в `USER_ALLOWED_COMMANDS`.
- Для продакшена лучше вынести TLS/ingress перед сервисом и ограничить сетью доступ к API/UI.
