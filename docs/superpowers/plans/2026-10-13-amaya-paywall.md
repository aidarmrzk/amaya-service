# Amaya Paywall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Сдать мобильный paywall с Figma, работающими Nuxt API, постоянной БД, живым URL и репозиторием.
**Architecture:** Один Nuxt-проект; сервер определяет каталог и пишет покупки в Appwrite Cloud TablesDB. Cookie устройства связывает покупку и восстановление. Vercel исполняет server routes.
**Tech Stack:** Nuxt 4, Vue, TypeScript, Appwrite TablesDB, Vitest, Playwright, Vercel.
**Spec:** ../specs/2026-10-13-amaya-paywall-design.md

## Global Constraints

- Один Nuxt-проект объединяет frontend и backend.
- Название: «Мир маленьких открытий». Язык интерфейса: русский.
- Основной фрейм: 390 px; адаптация проверяется при 360, 390 и 430 px.
- Тарифы: monthly — 299 ₽ за месяц; yearly — 1 990 ₽ за год.
- Минимальный размер основных зон нажатия — 44 px.
- Денежные списания и платежные SDK отсутствуют.
- Используется отдельный проект Appwrite для задания; существующие проекты и их таблицы не изменяются.
- .env не коммитится; настройки БД доступны только серверу.
- README до одной страницы; непроверенные требования отмечаются явно.

## Review Focus

1. Два одновременных запроса покупки: одна строка в БД, одинаковое подтверждение.
2. Сервер записал покупку, но ответ потерян: повтор с тем же requestId восстанавливает результат.
3. Cookie отсутствует или повреждена: создаётся новый UUID, чужие записи не доступны.
4. Переход loading/error/retry: выбор тарифа сохраняется, CTA не отправляет параллельные запросы.
5. Невысокий экран и safe area: CTA и восстановление доступны без горизонтального скролла.

## Файлы и границы

- app/pages/index.vue: экран; app/components/OfferCard.vue: доступная карточка radio.
- app/composables/usePaywall.ts: выбор, запросы, повтор и подтверждение.
- app/assets/css/main.css, public/fonts/, public/images/mascot.svg: стили и общие с Figma ресурсы.
- shared/types/paywall.ts: Offer, Purchase и ответы API.
- server/utils/offers.ts: каталог; server/utils/device.ts: cookie устройства.
- server/services/purchases.ts: проверка и покупка; server/repositories/purchases.ts: БД.
- server/api/offers.get.ts, purchase.post.ts, restore.post.ts: HTTP-адаптеры.
- appwrite.config.json и scripts/setup-appwrite.mjs: схема и ограничения.
- tests/unit/, tests/integration/, tests/e2e/: бизнес-логика, маршруты, браузер.
- nuxt.config.ts, package.json, tsconfig.json, vitest.config.ts, playwright.config.ts: запуск и проверки.
- .gitignore, .env.example, README.md, docs/design.md, docs/verification.md: конфигурация и передача.

### Task 1: Макет и каталог тарифов

**Files:** конфигурация проекта, shared/types/paywall.ts, server/utils/offers.ts, server/api/offers.get.ts, tests/unit/offers.test.ts, docs/design.md, public/fonts/, public/images/mascot.svg.
**Interfaces:** Offer = { id: 'monthly' | 'yearly'; title: string; amount: number; currency: 'RUB'; period: 'month' | 'year'; recommended: boolean }. getOffers(): readonly Offer[]. GET /api/offers -> { offers: Offer[] }.

- [ ] Проверить актуальные официальные инструкции Nuxt 4; зафиксировать версии зависимостей и lockfile. Настроить npm scripts dev, build, typecheck, test, test:e2e и .gitignore.
- [ ] Создать редактируемый макет Figma 390 px и вариант ошибки; экспортировать персонажа. Зафиксировать размеры, цвета, шрифты, интервалы и ссылку в docs/design.md. Общие ресурсы использовать без перерисовки в коде.
- [ ] Написать тест каталога; production-ошибка, которую он ловит: неверная сумма, валюта или рекомендованный тариф.

```ts
expect(getOffers().map(o => [o.id, o.amount, o.currency])).toEqual([
  ['monthly', 29900, 'RUB'], ['yearly', 199000, 'RUB']
])
expect(getOffers().filter(o => o.recommended).map(o => o.id)).toEqual(['yearly'])
```

- [ ] Запустить npm test -- tests/unit/offers.test.ts; увидеть отказ из-за отсутствующего каталога, затем реализовать getOffers() и HTTP-адаптер.
- [ ] Повторить тест: PASS. Запустить сервер, GET /api/offers должен вернуть обе записи с указанными ценами. Коммит feat: add offers and Figma design.

### Task 2: Сохранение и восстановление покупки

**Files:** shared/types/paywall.ts, server/services/purchases.ts, server/repositories/purchases.ts, server/utils/device.ts, server/api/purchase.post.ts, server/api/restore.post.ts, описание схемы Appwrite, .env.example, tests/unit/purchases.test.ts, tests/integration/api.test.ts.
**Interfaces:** Purchase = { id: string; offerId: Offer['id']; createdAt: string }. PurchaseRepository: findByRequest(deviceId: string, requestId: string): Promise<Purchase | null>; insert(deviceId: string, requestId: string, offerId: Offer['id']): Promise<Purchase>; findLatest(deviceId: string): Promise<Purchase | null>.
createPurchase(body: unknown, deviceId: string, repository: PurchaseRepository): Promise<Purchase>. restorePurchase(deviceId: string, repository: PurchaseRepository): Promise<{ purchased: boolean; purchase: Purchase | null }>. getDeviceId(event: H3Event): string.

- [ ] Написать тесты createPurchase и restorePurchase с тестовым in-memory репозиторием; сбои вставки моделировать на границе хранилища. Идентификаторы тестовых устройств и requestId — валидные UUID.

```ts
expect(await createPurchase(body, deviceA, repo)).toMatchObject({ offerId: 'yearly' })
expect(await createPurchase(body, deviceA, repo)).toEqual(await createPurchase(body, deviceA, repo))
expect(repo.rows).toHaveLength(1)
await expect(createPurchase({ ...body, offerId: 'unknown' }, deviceA, repo)).rejects.toMatchObject({ statusCode: 400 })
await expect(createPurchase({ ...body, requestId: 'broken' }, deviceA, repo)).rejects.toMatchObject({ statusCode: 400 })
await expect(createPurchase({ ...body, offerId: 'monthly' }, deviceA, repo)).rejects.toMatchObject({ statusCode: 409 })
expect(await restorePurchase(deviceB, repo)).toEqual({ purchased: false, purchase: null })
```

- [ ] Дополнить тестом отказа БД: createPurchase отклоняется с 503, успех не возвращается. Запустить npm test -- tests/unit/purchases.test.ts; убедиться, что недостающая реализация вызывает отказ.
- [ ] Реализовать проверку body и UUID, сервис и DB-адаптер. При конфликте уникальности читать сохранённую запись и проверять offerId. Настроить отдельный бесплатный Appwrite: offerId enum, deviceId/requestId varchar(36), серверный $createdAt, уникальный детерминированный ID строки, индекс device_created, rowSecurity и пустые permissions.
- [ ] Реализовать cookie amaya_device на год: UUID, HttpOnly, SameSite=Lax, Path=/, Secure в production. API не принимает deviceId или сумму от клиента. restore всегда использует cookie.
- [ ] Написать и выполнить HTTP-тесты: отсутствующая/повреждённая cookie заменяется, восстановление другого устройства пустое, корректные HTTP-коды 400/409/503. Для concurrency Promise.all двух одинаковых покупок проверить одинаковые id и COUNT(*) = 1 в реальной тестовой БД; повтор после потери ответа также возвращает тот же id.
- [ ] Запустить npm test: PASS. Проверить запись и восстановление через реальный API. Коммит feat: persist and restore demo purchases.

### Task 3: Экран по Figma

**Files:** app/pages/index.vue, app/components/OfferCard.vue, app/composables/usePaywall.ts, app/assets/css/main.css, nuxt.config.ts, tests/unit/paywall.test.ts, tests/e2e/paywall.spec.ts.
**Interfaces:** usePaywall(): { offers, selectedOfferId, status, error, purchase, loadOffers(): Promise<void>, buy(): Promise<void>, restore(): Promise<void> }; status = 'loading' | 'ready' | 'purchasing' | 'restoring' | 'success' | 'error'. API — интерфейсы Tasks 1–2.

- [ ] Написать тест переходов: загрузка выбирает yearly; изменение выбора на monthly меняет payload; при незавершённом buy повтор не отправляется; ошибка оставляет выбор; retry сохраняет requestId для того же тарифа, смена тарифа создаёт новый; success появляется только после ответа сервера.
- [ ] Запустить npm test -- tests/unit/paywall.test.ts, увидеть отказ; реализовать usePaywall с устойчивым requestId на время попытки и блокировкой конкурирующих purchase/restore.
- [ ] Написать браузерные проверки до экранной реализации: radio выбран yearly, monthly выбирается с клавиатуры, кнопка показывает загрузку, 503 отображает повтор, success подтверждает доступ, restore без записи показывает сообщение. Сетевые сбои воспроизводить через route interception.
- [ ] Запустить npm run test:e2e; увидеть отсутствие ожидаемого экрана. Сверстать Figma с общими шрифтами/SVG, точной типографикой и интервалами; radio, aria-live, safe area и доступной прокруткой.
- [ ] Запустить npm test и npm run test:e2e: PASS. На 360/390/430 px и высоте 640 px проверить document.scrollWidth <= innerWidth, возможность дойти до CTA/restore и размер зон >= 44 px. Коммит feat: implement mobile paywall states.

### Task 4: Проверка соответствия и публикация

**Files:** README.md, docs/design.md, docs/verification.md; поправки только файлов из Tasks 1–3 по результатам проверки.
**Interfaces:** публичный URL исполняет API из Tasks 1–2; Figma-ссылка разрешает просмотр; репозиторий содержит проект и миграцию без секретов.

- [ ] Запустить npm run typecheck, npm test, npm run test:e2e, npm run build; все команды завершаются успешно. При новой ошибке сначала воспроизвести её тестом.
- [ ] Снять скриншот 390 px и сравнить с экспортом Figma при одинаковых шрифтах и масштабе. Измерить долю пикселей, у которых максимальная разница RGB превышает 16; сохранить метод, число, снимки и найденные отклонения в docs/verification.md. Не выдавать эту метрику за гарантированное 99% совпадение без оговорки метода.
- [ ] Проверить Git diff и tracked files на .env, токены и личные файлы. Создать репозиторий задания через доступный GitHub-инструмент или gh; отправить проверенный коммит.
- [ ] Создать проект Vercel, настроить закрытые переменные окружения Appwrite, выполнить Nuxt server deployment. Платные ресурсы без отдельного разрешения не создавать. Если бесплатная БД недоступна, продолжить локальную проверку и явно указать блокер.
- [ ] На живом URL GET offers возвращает каталог; POST purchase с cookie сохраняет строку; повтор возвращает тот же id; restore с cookie возвращает эту покупку, без cookie — пустой результат. Проверить строку прямым запросом БД. Проверить мобильный экран на опубликованном URL.
- [ ] README до страницы: npm install / npm run dev; env и миграция; frontend/server/DB; Vercel/Appwrite и причины; Figma/live/repository ссылки; Codex и реальные проверки; ограничения; следующие два часа — подписанные device-токены, expiry и дополнительные webview-тесты.
- [ ] Коммит docs: add delivery links and verification results; отправить финальное состояние репозитория. Передать проверенные ссылки и перечислить только оставшиеся реальные ограничения.

## Самопроверка плана

- Все требования spec покрыты четырьмя задачами; Figma создаётся до верстки.
- Интерфейсы используют offerId/createdAt в API и offerId/$createdAt в БД с явным преобразованием.
- Все пять Review Focus имеют проверки в Tasks 2–3.
- Setup и документация включены в задачи, которым нужны; продуктовые функции не расширены.
- Предложенный способ исполнения: Native, последовательно в текущем чате; независимая итоговая проверка через доступный инструмент code review.

Уточнение пользователя: 2026-10-13 Appwrite выбран вместо Supabase. Проверка адаптера SDK добавлена в tests/unit/appwrite.test.ts. Ключ только rows.read/rows.write; схема настроена через штатную консоль.
