export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Modem Control Service API",
    version: "0.1.0",
    description:
      "API for modem control via AT commands, JWT/API-token auth, RBAC, logs and modem mode recovery.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Modem" },
    { name: "Logs" },
    { name: "Tokens" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT or API token",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
          details: { type: "string", example: "Invalid API token" },
          code: { type: "string", example: "PASSWORD_CHANGE_REQUIRED" },
        },
        required: ["error"],
      },
      Principal: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          username: { type: "string", example: "root" },
          role: { type: "string", enum: ["admin", "user"], example: "admin" },
          authType: { type: "string", enum: ["jwt", "api_token"], example: "jwt" },
          tokenId: { type: "integer", nullable: true, example: 12 },
          mustChangePassword: { type: "boolean", example: false },
        },
        required: ["id", "username", "role", "authType", "mustChangePassword"],
      },
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "root" },
          password: {
            type: "string",
            example: "strong-password",
            description: "User password or an API token issued for this username",
          },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOi..." },
          user: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              username: { type: "string", example: "root" },
              role: { type: "string", enum: ["admin", "user"], example: "admin" },
              mustChangePassword: { type: "boolean", example: false },
            },
            required: ["id", "username", "role", "mustChangePassword"],
          },
        },
        required: ["accessToken", "user"],
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", example: "old-password" },
          newPassword: { type: "string", minLength: 8, example: "new-strong-password" },
        },
      },
      ChangePasswordResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string", example: "eyJhbGciOi..." },
          user: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              username: { type: "string", example: "root" },
              role: { type: "string", enum: ["admin", "user"], example: "admin" },
              mustChangePassword: { type: "boolean", example: false },
            },
            required: ["id", "username", "role", "mustChangePassword"],
          },
        },
        required: ["accessToken", "user"],
      },
      CreateUserRequest: {
        type: "object",
        required: ["username", "password", "role"],
        properties: {
          username: { type: "string", example: "operator" },
          password: { type: "string", example: "operator-pass" },
          role: { type: "string", enum: ["admin", "user"], example: "user" },
        },
      },
      CreateUserResponse: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          username: { type: "string", example: "operator" },
          role: { type: "string", enum: ["admin", "user"], example: "user" },
        },
        required: ["id", "username", "role"],
      },
      ModemStatusResponse: {
        type: "object",
        properties: {
          connected: { type: "boolean", example: true },
          path: { type: "string", example: "/dev/ttyACM0" },
          baudRate: { type: "integer", example: 9600 },
          lastError: { type: "string", nullable: true, example: null },
        },
        required: ["connected", "path", "baudRate", "lastError"],
      },
      ModemModeResponse: {
        type: "object",
        properties: {
          atModeReady: { type: "boolean", example: true },
        },
        required: ["atModeReady"],
      },
      RecoverModeResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          message: {
            type: "string",
            example: "Recovered AT command mode via modem init sequence (ATH/ATZ/FCLASS)",
          },
        },
        required: ["ok", "message"],
      },
      SendAtRequest: {
        type: "object",
        required: ["command"],
        properties: {
          command: { type: "string", example: "AT+CSQ" },
          timeoutMs: { type: "integer", minimum: 1, maximum: 60000, example: 5000 },
        },
      },
      SendAtResponse: {
        type: "object",
        properties: {
          response: { type: "string", example: "AT+CSQ\n+CSQ: 20,99\nOK" },
          durationMs: { type: "integer", example: 220 },
        },
        required: ["response", "durationMs"],
      },
      CommandLogEntry: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1001 },
          actor_user_id: { type: "integer", nullable: true, example: 1 },
          actor_token_id: { type: "integer", nullable: true, example: null },
          actor_username: { type: "string", example: "root" },
          actor_role: { type: "string", enum: ["admin", "user"], example: "admin" },
          command: { type: "string", example: "AT+CSQ" },
          response: { type: "string", nullable: true, example: "AT+CSQ\n+CSQ: 20,99\nOK" },
          status: { type: "string", enum: ["ok", "error", "blocked"], example: "ok" },
          error: { type: "string", nullable: true, example: null },
          duration_ms: { type: "integer", nullable: true, example: 210 },
          created_at: { type: "string", format: "date-time", example: "2026-03-23T10:20:30.000Z" },
        },
        required: [
          "id",
          "actor_user_id",
          "actor_token_id",
          "actor_username",
          "actor_role",
          "command",
          "response",
          "status",
          "error",
          "duration_ms",
          "created_at",
        ],
      },
      LogsResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/CommandLogEntry" },
          },
        },
        required: ["items"],
      },
      LogsCleanupResponse: {
        type: "object",
        properties: {
          deleted: { type: "integer", example: 120 },
          retentionDays: { type: "integer", example: 30 },
        },
        required: ["deleted", "retentionDays"],
      },
      ApiTokenEntry: {
        type: "object",
        properties: {
          id: { type: "integer", example: 7 },
          name: { type: "string", example: "integration" },
          role: { type: "string", enum: ["admin", "user"], example: "user" },
          created_by: { type: "integer", example: 1 },
          created_at: { type: "string", format: "date-time", example: "2026-03-23T08:10:00.000Z" },
          last_used_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: "2026-03-23T10:00:00.000Z",
          },
          revoked_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            example: null,
          },
        },
        required: ["id", "name", "role", "created_by", "created_at", "last_used_at", "revoked_at"],
      },
      ListTokensResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ApiTokenEntry" },
          },
        },
        required: ["items"],
      },
      CreateTokenRequest: {
        type: "object",
        required: ["name", "role"],
        properties: {
          name: { type: "string", example: "integration" },
          role: { type: "string", enum: ["admin", "user"], example: "user" },
        },
      },
      CreateTokenResponse: {
        type: "object",
        properties: {
          id: { type: "integer", example: 7 },
          name: { type: "string", example: "integration" },
          role: { type: "string", enum: ["admin", "user"], example: "user" },
          token: { type: "string", example: "xEkmpC6Jp..." },
        },
        required: ["id", "name", "role", "token"],
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          modem: { $ref: "#/components/schemas/ModemStatusResponse" },
        },
        required: ["status", "modem"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service health",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with username + password or API token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "JWT token + user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Authenticated principal",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/Principal" },
                  },
                  required: ["user"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change account password",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Password changed and refreshed JWT returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChangePasswordResponse" },
              },
            },
          },
          "400": {
            description: "Validation or business rule error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Current password invalid / unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden (e.g. API token session)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/users": {
      post: {
        tags: ["Users"],
        summary: "Create user (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateUserRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "User created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden (role / password change required)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Username already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/modem/status": {
      get: {
        tags: ["Modem"],
        summary: "Get modem connection status",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Modem status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModemStatusResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/modem/mode": {
      get: {
        tags: ["Modem"],
        summary: "Check if modem is in AT command mode",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Mode check result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModemModeResponse" },
              },
            },
          },
          "502": {
            description: "Serial/modem check error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/modem/recover-mode": {
      post: {
        tags: ["Modem"],
        summary: "Try to recover modem AT command mode",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Recovery result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RecoverModeResponse" },
              },
            },
          },
          "502": {
            description: "Recovery failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/at/send": {
      post: {
        tags: ["Modem"],
        summary: "Send AT command",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendAtRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "AT response",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SendAtResponse" },
              },
            },
          },
          "403": {
            description: "Blocked by role policy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "502": {
            description: "Modem command failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/logs": {
      get: {
        tags: ["Logs"],
        summary: "Get command logs",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            required: false,
            description: "Maximum logs in response",
          },
        ],
        responses: {
          "200": {
            description: "List of logs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/logs/cleanup": {
      post: {
        tags: ["Logs"],
        summary: "Delete old logs by retention policy (admin only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Cleanup result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogsCleanupResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/logs/stream": {
      get: {
        tags: ["Logs"],
        summary: "Stream logs via SSE",
        description:
          "Use query `token` or `Authorization: Bearer ...`. Response is `text/event-stream`.",
        parameters: [
          {
            in: "query",
            name: "token",
            schema: { type: "string" },
            required: false,
          },
        ],
        responses: {
          "200": {
            description: "SSE stream with `data: {...}` events",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  example: "event: ready\\ndata: {}\\n\\ndata: {\"id\":1,\"command\":\"AT\"}\\n\\n",
                },
              },
            },
          },
          "401": {
            description: "Missing/invalid token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/tokens": {
      get: {
        tags: ["Tokens"],
        summary: "List API tokens (admin only)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Token list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListTokensResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tokens"],
        summary: "Create API token (admin only)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTokenRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Token created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTokenResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/tokens/{id}/revoke": {
      post: {
        tags: ["Tokens"],
        summary: "Revoke API token (admin only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "204": { description: "Token revoked" },
          "400": {
            description: "Invalid token id",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
} as const;
