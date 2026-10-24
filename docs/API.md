# Phase 01 API

Base URL: `http://127.0.0.1:3000/api`. JSON request/response bodies. All POSTs require `Origin: http://127.0.0.1:3000` (or configured APP_ORIGIN). Authenticated endpoints require the HttpOnly session cookie; the browser sends it automatically. Errors use `{ "error": "Human-readable message" }`.

| Method/path                      | Body                               | Result                                          |
| -------------------------------- | ---------------------------------- | ----------------------------------------------- |
| POST `/auth/register`            | `name, workspace, email, password` | User + session cookie; creates owner membership |
| POST `/auth/login`               | `email, password`                  | User + new session cookie                       |
| POST `/auth/logout`              | `{}`                               | Deletes server session and cookie               |
| GET `/session`                   | —                                  | User and visible workspaces                     |
| POST `/workspaces`               | `name`                             | New workspace + owner membership                |
| GET `/workspaces/:id`            | —                                  | Tenant datasets and 20 latest forecasts         |
| POST `/workspaces/:id/datasets`  | `name, csv`                        | Validated stored dataset summary                |
| POST `/workspaces/:id/forecasts` | `datasetId, horizon`               | Persisted mock forecast                         |

Status codes: 400 invalid input, 401 unauthenticated/expired, 403 rejected origin, 404 unknown/inaccessible resource, 409 registration conflict, 413 oversized body, 429 attempt limit, 503 forecast service unavailable, 500 generic unexpected failure.

Python listens on `127.0.0.1:8001` only. GET `/health` returns service status and `mode: mock`. POST `/forecast` requires `Authorization: Bearer <FORECAST_SERVICE_TOKEN>` and `{points:[{date:"YYYY-MM-DD",value:100}],horizon:14}` with 8–5,000 daily points. Returns `{mock:true,model:"weekly-repeat-mock-v1",points:[...],notice:"..."}`. The browser must never call this service directly. No CORS access is enabled.
