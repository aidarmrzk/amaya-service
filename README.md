# Amaya — тестовый мобильный paywall

Nuxt 4 + TypeScript, server routes и Appwrite Cloud TablesDB. Покупка демонстрационная, без денег и платёжного SDK.

**Макет:** https://www.figma.com/design/ilLSwv47wIKiWUmDkYGRBx?node-id=2-2

## Локальный запуск

Node.js 24.15+ (проверено на 24.19). `npm ci`, скопировать `.env.example` в `.env`, указать серверный Appwrite API key только с `rows.read`/`rows.write`, затем `npm run dev`.
Схема уже создана в отдельном проекте; для своей БД см. `docs/appwrite.md` и `appwrite.config.json`. Административный setup-скрипт `npm run db:setup` требует отдельного ключа настройки схемы; runtime-ключ его запускать не может.

## Структура и решения

- `app/pages/index.vue`, `app/components/OfferCard.vue`, `app/composables/usePaywall.ts`: экран, выбор тарифа, loading/error/retry/success и восстановление.
- `server/api`: GET `/api/offers`, POST `/api/purchase`, POST `/api/restore`. Каталог и валидация цены находятся на сервере.
- `server/repositories/appwrite.ts`: постоянная БД Appwrite. Сохраняются offerId, deviceId, requestId и серверное время $createdAt; стабильный row ID исключает дубликаты при повторе запроса.
- Vercel запускает Nuxt server routes; Appwrite Free хранит данные независимо от функций. Клиент не получает API key и прямые permissions таблицы.

## Проверки и AI

Использован Codex для дизайна, кода и тестов, Figma MCP для редактируемого макета. Проверены `npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run build`; браузерные сценарии на 360/390/430 px. `npm run test:smoke -- URL` проверяет настоящий API, конкурентную покупку, восстановление и строку Appwrite. Результаты и сравнение скриншотов — `docs/verification.md`.

Ограничения: cookie устройства — условный идентификатор без авторизации; после удаления cookie восстановление недоступно. Подписки и реальная игра не реализуются в рамках задания. Ключ действителен до 13.10.2027. Пиксельные метрики описаны отдельно: различия сглаживания текста не скрыты обещанием буквального 99% совпадения.

Ещё за два часа: подписанные device-токены и сроки доступа, проверка iOS/Android webview и дополнительная проверка доступности.
