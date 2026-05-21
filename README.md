<h1>
  <img src="https://i.ibb.co/bZY7X9r/8b3b8b98-7525-4e3d-89d4-0bd546adab82-removebg-preview.png" width="36" height="36" align="center" alt="YTReUp logo" />
  YTReUp
</h1>

<p>
  <strong>YTReUp</strong> — десктопное приложение для скачивания видео через <code>yt-dlp</code>, повторной загрузки на YouTube, управления очередью, просмотра и редактирования уже опубликованных видео.
</p>

<p>
  <a href="README.en.md">English</a>
</p>

---

## О проекте

YTReUp помогает быстро работать с YouTube-контентом в одном приложении: скачать видео по ссылке, подготовить метаданные, загрузить ролик на YouTube, посмотреть список уже опубликованных видео, найти нужный ролик, открыть детали и изменить название, описание, теги и параметры публикации.

Приложение работает как локальный desktop-клиент на Electron. Авторизация YouTube выполняется через OAuth 2.0, а данные доступа сохраняются локально на устройстве пользователя.

---

## Возможности

- Скачивание видео по ссылке через `yt-dlp`.
- Получение информации о видео перед скачиванием.
- Выбор качества скачивания.
- Выбор папки для сохранения файлов.
- Загрузка видео на YouTube через YouTube Data API.
- OAuth 2.0 авторизация через системный браузер и локальный redirect на `127.0.0.1`.
- Очередь задач для скачивания и загрузки.
- Сохранение очереди локально.
- Просмотр статистики канала: подписчики, просмотры, количество видео.
- Список последних видео канала.
- Отдельный раздел для управления видео.
- Поиск по собственным видео на YouTube.
- Загрузка дополнительных страниц видео через `nextPageToken`.
- Разделение обычных видео и Shorts.
- Просмотр деталей уже опубликованного видео.
- Редактирование названия, описания, тегов, категории, языка, лицензии и приватности.
- Настройки `made for kids`, встраивания и видимости рейтингов.
- Копирование ссылки на видео.
- Открытие видео во внешнем браузере.
- Локализация интерфейса на русский и английский языки.
- Переключатель языка RU / EN в интерфейсе.
- Современный тёмный интерфейс.

---

## Стек

- Electron
- Vue 3
- Vite
- Pinia
- Vue Router
- YouTube Data API v3
- OAuth 2.0
- yt-dlp
- JavaScript
- CSS

---

## Структура проекта

```text
YTReUp/
├── bin/
│   └── yt-dlp
├── electron/
│   ├── main.js
│   └── preload.js
├── public/
│   └── icon.png
├── src/
│   ├── stores/
│   │   ├── i18n.js
│   │   ├── queue.js
│   │   └── youtube.js
│   ├── views/
│   │   ├── Dashboard.vue
│   │   ├── Download.vue
│   │   ├── Queue.vue
│   │   ├── Settings.vue
│   │   ├── Upload.vue
│   │   └── Videos.vue
│   ├── App.vue
│   ├── main.js
│   ├── router.js
│   └── style.css
├── package.json
├── README.md
├── README.ru.md
└── README.en.md
```

---

## Требования

Перед запуском нужны:

- Node.js 18 или новее.
- npm.
- Google Cloud Project.
- Включённый YouTube Data API v3.
- OAuth Client типа Desktop app.
- `yt-dlp` в папке `bin/` или установленный в системе.
- `ffmpeg`, если `yt-dlp` должен объединять видео и аудио в один файл.

---

## Установка

Склонируйте репозиторий:

```bash
git clone https://github.com/your-username/YTReUp.git
cd YTReUp
```

Установите зависимости:

```bash
npm install
```

Запустите приложение в режиме разработки:

```bash
npm run dev
```

Соберите приложение:

```bash
npm run build
```

---

## Установка yt-dlp

### macOS

Вариант 1 — положить бинарник внутрь проекта:

```bash
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o bin/yt-dlp
chmod +x bin/yt-dlp
./bin/yt-dlp --version
```

Вариант 2 — установить через Homebrew:

```bash
brew install yt-dlp ffmpeg
```

Если приложение собирается в `.dmg`, лучше держать `yt-dlp` в папке `bin/` и добавить её в `extraResources`.

Пример настройки в `package.json`:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "bin",
        "to": "bin"
      }
    ]
  }
}
```

---

## Настройка Google Cloud и YouTube OAuth

1. Откройте Google Cloud Console.
2. Создайте новый проект или выберите существующий.
3. Перейдите в `APIs & Services`.
4. Включите `YouTube Data API v3`.
5. Перейдите в `Google Auth Platform`.
6. В разделе `Audience` выберите `External`.
7. Для личного использования оставьте статус публикации `Testing`.
8. Добавьте свой Google-аккаунт в `Test users`.
9. В разделе `Data Access` добавьте scopes:

```text
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

10. В разделе `Clients` создайте OAuth Client.
11. Тип приложения выберите `Desktop app`.
12. Скопируйте `Client ID` и `Client Secret`.
13. Вставьте их в разделе `Settings` внутри YTReUp.
14. Нажмите `Connect YouTube`.

После успешной авторизации браузер покажет сообщение `YouTube connected`, а приложение получит access token и refresh token.

---

## Почему нужен scope `youtube`

Для обычной загрузки видео достаточно `youtube.upload`, но для редактирования уже опубликованных роликов нужен более широкий доступ:

```text
https://www.googleapis.com/auth/youtube
```

После добавления нового scope нужно заново подключить аккаунт:

1. Нажмите `Disconnect` в приложении.
2. Сохраните credentials заново.
3. Нажмите `Connect YouTube`.

---

## Использование

### 1. Подключение YouTube

Откройте `Settings`, вставьте `Client ID` и `Client Secret`, сохраните данные и нажмите `Connect YouTube`.

### 2. Скачивание видео

Откройте `Download`, вставьте ссылку на видео, нажмите `Get Info`, выберите качество и папку для сохранения, затем нажмите `Download`.

### 3. Очередь

Видео можно добавлять в очередь. Очередь сохраняется локально и не пропадает после перезапуска приложения.

### 4. Загрузка на YouTube

Откройте `Upload`, выберите локальный видеофайл, заполните название, описание, теги и настройки публикации, затем запустите загрузку.

### 5. Управление видео

Откройте `Videos`, чтобы посмотреть ролики канала. Доступны поиск, фильтрация по типу, просмотр деталей и редактирование данных видео.

---

## Разделение видео и Shorts

YTReUp определяет Shorts локально по длительности ролика. Если длительность видео меньше или равна 60 секундам, приложение относит его к Shorts.

---

## Локализация

Приложение поддерживает два языка:

- Русский
- Английский

Переключатель языка находится в верхней панели приложения. Выбранный язык сохраняется локально.

---

## Где хранятся настройки

Настройки приложения сохраняются локально через Electron `userData`.

На macOS путь обычно выглядит так:

```text
~/Library/Application Support/YTReUp/config.json
```

В конфиге могут храниться:

- Client ID
- Client Secret
- access token
- refresh token
- папка скачивания
- язык интерфейса

Не публикуйте этот файл и не добавляйте его в Git.

---

## Безопасность

- OAuth-данные хранятся локально на устройстве.
- Приложение не отправляет Client Secret на сторонний сервер.
- Авторизация проходит через официальный OAuth Google.
- Для публичного распространения приложения может потребоваться верификация OAuth-приложения в Google.
- Не коммитьте `config.json`, токены, ключи и секреты.

---

## Сборка

Обычная сборка:

```bash
npm run build
```

Если на macOS сборка падает из-за `which python`, создайте локальный shim:

```bash
mkdir -p .bin
printf '#!/bin/sh\nexec python3 "$@"\n' > .bin/python
chmod +x .bin/python
PATH="$PWD/.bin:$PATH" npm run build
```

---

## Частые ошибки

### `403: org_internal`

OAuth-приложение создано как Internal. Нужно переключить User type на External или создать новый проект с External audience.

### `Access blocked`

Аккаунт не добавлен в Test users или приложение ещё не опубликовано. Добавьте свой Gmail в список тестеров.

### `Google hasn't verified this app`

Для тестового личного приложения это нормально. Нажмите `Advanced` и продолжите вход. Для публичного распространения нужна верификация приложения.

### `spawn yt-dlp ENOENT`

Приложение не нашло `yt-dlp`. Добавьте бинарник:

```bash
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o bin/yt-dlp
chmod +x bin/yt-dlp
```

### `No YouTube channel found on this Google account`

Вы вошли в Google-аккаунт, у которого нет YouTube-канала. Создайте канал или выберите другой аккаунт.

### `invalid_grant`

Токен устарел, был отозван или credentials изменились. Нажмите `Disconnect`, сохраните Client ID / Client Secret заново и подключите аккаунт ещё раз.

### Ошибка квоты YouTube API

Поиск и загрузка видео расходуют квоту YouTube Data API. Если квота закончилась, нужно подождать сброса лимита или увеличить квоту в Google Cloud.
