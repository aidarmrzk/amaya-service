# Настройка Appwrite

Отдельный проект: 6ace4d27001671c66a18, endpoint https://fra.cloud.appwrite.io/v1.
База amaya, таблица purchases, rowSecurity=true, permissions=[].
Столбцы: offerId enum monthly/yearly (required), deviceId varchar(36)
(required), requestId varchar(36) (required). Время хранится в системном
$createdAt. Индекс device_created: deviceId ASC, $createdAt DESC.
Стабильный ID строки вычисляется на сервере из deviceId и requestId;
повтор запроса не создаёт новую строку.

Production-ключ: только rows.read и rows.write, закрытый runtimeConfig.
Ключ не включается в Git и frontend. Срок действия текущего ключа —
13 октября 2027; до этой даты его нужно заменить в локальном .env и Vercel.

Для новой установки создайте схему через консоль Appwrite или запустите
npm run db:setup с отдельным административным ключом, имеющим
columns.write, databases.write, indexes.read/write, tables.read/write.
Не используйте административный ключ в приложении. Скрипт не удаляет данные.
Описание параметров: appwrite.config.json.

Официальный SDK и TablesDB:
https://appwrite.io/docs/quick-starts/node
https://appwrite.io/docs/references/cloud/server-nodejs/tablesDB
