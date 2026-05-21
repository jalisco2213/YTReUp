<h1>
  <img src="https://i.ibb.co/bZY7X9r/8b3b8b98-7525-4e3d-89d4-0bd546adab82-removebg-preview.png" width="36" height="36" alt="YTReUp logo" />
  YTReUp
</h1>

**YTReUp** — desktop-приложение для скачивания видео через `yt-dlp`, загрузки роликов на YouTube и управления уже опубликованными видео в одном удобном интерфейсе.

Приложение создано для тех, кому нужно быстро скачать видео по ссылке, подготовить метаданные, поставить ролик в очередь, загрузить его на YouTube и при необходимости отредактировать уже опубликованное видео.

---

## Что умеет YTReUp

- Скачивать видео по ссылке через `yt-dlp`.
- Получать информацию о видео перед скачиванием: название, канал, длительность, описание и превью.
- Выбирать качество скачивания: лучшее качество, 2160p, 1440p, 1080p, 720p, 480p.
- Скачивать видео в высоком качестве через связку `yt-dlp + ffmpeg`.
- Выбирать папку для сохранения файлов.
- Работать с очередью скачивания.
- Сохранять очередь локально между запусками приложения.
- Загружать видео на YouTube через YouTube Data API v3.
- Авторизоваться через Google OAuth 2.0.
- Просматривать информацию о подключённом YouTube-канале.
- Смотреть список опубликованных видео.
- Загружать дополнительные страницы видео через `nextPageToken`.
- Разделять обычные видео и Shorts.
- Искать видео по каналу.
- Открывать детали уже опубликованного видео.
- Редактировать название, описание, теги, категорию, язык, лицензию и приватность.
- Настраивать параметры `made for kids`, встраивания и отображения рейтингов.
- Копировать ссылку на видео.
- Открывать видео во внешнем браузере.
- Переключать интерфейс между русским и английским языком.
- Работать в современном тёмном интерфейсе.

---

## Стек

- Electron
- Vue 3
- Vite
- Pinia
- Vue Router
- YouTube Data API v3
- Google OAuth 2.0
- yt-dlp
- ffmpeg
- JavaScript
- CSS

---

## Структура проекта

```text
YTReUp/
├── bin/
│   ├── .gitkeep
│   ├── yt-dlp
│   ├── yt-dlp.exe
│   ├── ffmpeg
│   └── ffmpeg.exe
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
│   │   ├── Settings.vue
│   │   ├── Upload.vue
│   │   └── Videos.vue
│   ├── App.vue
│   ├── main.js
│   ├── router.js
│   └── style.css
├── package.json
├── README.md
└── README.en.md
```

> `bin/` используется для локальных бинарников `yt-dlp` и `ffmpeg`. Обычно эти файлы не коммитят в репозиторий, потому что они тяжёлые и зависят от операционной системы.

---

## Требования

Перед запуском нужны:

- Node.js 18 или новее.
- npm.
- Google Cloud Project.
- Включённый YouTube Data API v3.
- OAuth Client типа `Desktop app`.
- `yt-dlp`.
- `ffmpeg` для скачивания видео в хорошем качестве.

---

## Почему нужен ffmpeg

YouTube часто отдаёт видео в хорошем качестве отдельными потоками:

- отдельный поток видео;
- отдельный поток аудио.

`yt-dlp` скачивает оба потока, а `ffmpeg` объединяет их в один итоговый файл. Без `ffmpeg` приложение может получить только одиночный MP4-файл в низком качестве, поэтому для 1080p, 1440p и 2160p лучше обязательно установить `ffmpeg`.

---

## Установка проекта

```bash
git clone https://github.com/your-username/YTReUp.git
cd YTReUp
npm install
```

Запуск в режиме разработки:

```bash
npm run dev
```

Сборка приложения:

```bash
npm run build
```

---

## Установка yt-dlp и ffmpeg

### Вариант 1: установить в систему

#### macOS

```bash
brew install yt-dlp ffmpeg
```

Проверка:

```bash
yt-dlp --version
ffmpeg -version
```

#### Windows

Можно установить через `winget`:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Проверка:

```powershell
yt-dlp --version
ffmpeg -version
```

---

### Вариант 2: положить файлы в папку bin

Этот вариант удобен для сборки приложения, потому что `electron-builder` может включить папку `bin/` в готовый билд.

#### macOS

```bash
mkdir -p bin

curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o bin/yt-dlp
chmod +x bin/yt-dlp

brew install ffmpeg
cp "$(which ffmpeg)" bin/ffmpeg
chmod +x bin/ffmpeg
```

Проверка:

```bash
./bin/yt-dlp --version
./bin/ffmpeg -version
```

#### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path bin | Out-Null

Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "bin\yt-dlp.exe"

Invoke-WebRequest "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile "$env:TEMP\ffmpeg.zip"

Remove-Item "$env:TEMP\ffmpeg-ytreup" -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "$env:TEMP\ffmpeg.zip" "$env:TEMP\ffmpeg-ytreup" -Force

Copy-Item "$env:TEMP\ffmpeg-ytreup\ffmpeg-*\bin\ffmpeg.exe" "bin\ffmpeg.exe" -Force
```

Проверка:

```powershell
.\bin\yt-dlp.exe --version
.\bin\ffmpeg.exe -version
```

---

## Нужно ли коммитить yt-dlp.exe и ffmpeg.exe

Лучше не коммитить бинарники в GitHub.

Рекомендуемый `.gitignore`:

```gitignore
bin/*
!bin/.gitkeep
```

Рекомендуемая структура:

```text
bin/
└── .gitkeep
```

Почему так лучше:

- `ffmpeg` может весить десятки или сотни мегабайт.
- Git плохо подходит для хранения больших бинарных файлов.
- Для разных ОС нужны разные файлы.
- При обновлении бинарников история репозитория быстро раздувается.
- Для публичного проекта проще хранить инструкции установки или скачивать бинарники отдельным скриптом.

Если всё же нужно хранить бинарники в репозитории, лучше использовать Git LFS и добавить рядом лицензии.

---

## Настройка package.json для сборки с bin

Если вы хотите, чтобы `bin/` попадала в готовую сборку приложения, добавьте `extraResources`:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "bin/",
        "to": "bin/",
        "filter": ["**/*"]
      }
    ]
  }
}
```

---

## Настройка Google Cloud и YouTube OAuth

### 1. Создайте проект

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Создайте новый проект или выберите существующий.
3. Перейдите в `APIs & Services`.
4. Откройте `Library`.
5. Найдите `YouTube Data API v3`.
6. Нажмите `Enable`.

### 2. Настройте OAuth consent screen

1. Перейдите в `Google Auth Platform`.
2. Откройте `Audience`.
3. Выберите тип приложения `External`.
4. Для личного использования можно оставить приложение в режиме `Testing`.
5. Добавьте свой Google-аккаунт в `Test users`.

### 3. Добавьте scopes

В разделе `Data Access` добавьте scopes:

```text
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

Для загрузки видео нужен `youtube.upload`.

Для просмотра и редактирования уже опубликованных видео нужен более широкий scope:

```text
https://www.googleapis.com/auth/youtube
```

### 4. Создайте OAuth Client

1. Откройте раздел `Clients`.
2. Нажмите `Create Client`.
3. Выберите тип приложения `Desktop app`.
4. Скопируйте `Client ID`.
5. Скопируйте `Client Secret`.

### 5. Подключите YouTube в приложении

1. Откройте YTReUp.
2. Перейдите в `Settings`.
3. Вставьте `Client ID`.
4. Вставьте `Client Secret`.
5. Сохраните настройки.
6. Нажмите `Connect YouTube`.
7. Авторизуйтесь в браузере.
8. После успешного входа вернитесь в приложение.

---

## Как пользоваться

### Скачивание видео

1. Откройте страницу `Download`.
2. Вставьте ссылку на YouTube-видео.
3. Нажмите `Get Info`.
4. Проверьте название, канал, длительность и описание.
5. Выберите качество.
6. Выберите папку сохранения.
7. Нажмите `Download`.

Если нужно скачать несколько роликов, добавьте их в очередь.

---

### Очередь

Очередь находится на странице `Download`, под полем ссылки.

В очереди можно:

- видеть список добавленных видео;
- запускать скачивание одного видео;
- запускать обработку всей очереди;
- видеть прогресс;
- видеть скорость скачивания;
- видеть примерное оставшееся время;
- открыть папку с готовым файлом;
- перейти к загрузке готового файла на YouTube;
- удалить задачу из очереди;
- очистить готовые задачи.

Очередь хранится локально и не пропадает после перезапуска приложения.

---

### Загрузка на YouTube

1. Откройте страницу `Upload`.
2. Выберите локальный видеофайл.
3. Заполните название.
4. Заполните описание.
5. Укажите теги.
6. Выберите категорию.
7. Выберите приватность.
8. Запустите загрузку.

После загрузки приложение покажет ссылку на видео.

---

### Управление опубликованными видео

Откройте страницу `Videos`.

Там можно:

- посмотреть список видео канала;
- загрузить дополнительные страницы видео;
- искать ролики;
- отдельно смотреть обычные видео и Shorts;
- открыть детали видео;
- изменить название;
- изменить описание;
- изменить теги;
- изменить категорию;
- изменить язык;
- изменить лицензию;
- изменить приватность;
- скопировать ссылку;
- открыть видео в браузере.

---

## Как YTReUp определяет Shorts

YTReUp определяет Shorts локально по длительности ролика.

Если длительность меньше или равна 60 секундам, видео отображается как Shorts.

---

## Локализация

Поддерживаемые языки:

- Русский
- Английский

Переключатель языка находится в верхней панели приложения.

Выбранный язык сохраняется локально.

---

## Где хранятся настройки

Настройки сохраняются локально через Electron `userData`.

Примерный путь на macOS:

```text
~/Library/Application Support/YTReUp/config.json
```

Примерный путь на Windows:

```text
C:\Users\<USER>\AppData\Roaming\YTReUp\config.json
```

В конфиге могут храниться:

- `Client ID`;
- `Client Secret`;
- `access token`;
- `refresh token`;
- папка скачивания;
- язык интерфейса.

Не публикуйте этот файл и не добавляйте его в Git.

---

## Безопасность

- OAuth-данные хранятся локально на устройстве пользователя.
- `Client Secret` не отправляется на сторонний сервер.
- Авторизация проходит через официальный OAuth Google.
- Для публичного распространения приложения может потребоваться верификация OAuth-приложения в Google.
- Не коммитьте токены, ключи, секреты и локальный `config.json`.
- Не публикуйте свои Google OAuth credentials в README, Issues, Pull Requests или скриншотах.

---

## Частые ошибки

### `spawn yt-dlp ENOENT`

Приложение не нашло `yt-dlp`.

Решение:

```bash
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o bin/yt-dlp
chmod +x bin/yt-dlp
```

Или установите `yt-dlp` в систему.

---

### `Для скачивания в хорошем качестве нужен ffmpeg`

Для высокого качества нужен `ffmpeg`.

macOS:

```bash
brew install ffmpeg
```

Windows:

```powershell
winget install Gyan.FFmpeg
```

Или положите `ffmpeg` / `ffmpeg.exe` в папку `bin/`.

---

### Видео скачалось в плохом качестве

Обычно причина в отсутствии `ffmpeg`.

YouTube может отдавать 1080p и выше отдельным видео-потоком без аудио. Чтобы получить итоговый файл с нормальным качеством и звуком, нужен `ffmpeg`.

---

### `403: org_internal`

OAuth-приложение создано как `Internal`.

Решение:

- используйте `External`;
- или создайте новый Google Cloud Project с внешней аудиторией.

---

### `Access blocked`

Аккаунт не добавлен в список тестеров или приложение не опубликовано.

Решение:

1. Откройте Google Cloud Console.
2. Перейдите в Google Auth Platform.
3. Добавьте свой Gmail в `Test users`.
4. Повторите авторизацию.

---

### `Google hasn't verified this app`

Для личного тестового приложения это нормально.

Решение:

1. Нажмите `Advanced`.
2. Продолжите вход.
3. Для публичного распространения пройдите верификацию OAuth-приложения.

---

### `No YouTube channel found on this Google account`

Вы вошли в Google-аккаунт, у которого нет YouTube-канала.

Решение:

- создайте YouTube-канал;
- или выберите другой Google-аккаунт.

---

### `invalid_grant`

Токен устарел, был отозван или credentials изменились.

Решение:

1. Нажмите `Disconnect`.
2. Проверьте `Client ID` и `Client Secret`.
3. Сохраните настройки.
4. Подключите YouTube заново.

---

### Ошибка квоты YouTube API

YouTube Data API имеет дневную квоту.

Если квота закончилась:

- подождите сброса лимита;
- уменьшите количество запросов;
- запросите увеличение квоты в Google Cloud Console.

---

## Сборка

Обычная сборка:

```bash
npm run build
```

Если на macOS сборка падает из-за `which python`, можно использовать локальный shim:

```bash
mkdir -p .bin
printf '#!/bin/sh\nexec python3 "$@"\n' > .bin/python
chmod +x .bin/python
PATH="$PWD/.bin:$PATH" npm run build
```

---

## Рекомендации для публичного репозитория

Добавьте `.gitignore`:

```gitignore
node_modules/
dist/
dist-electron/
.DS_Store
.env
.env.*
*.log

bin/*
!bin/.gitkeep
```

Не публикуйте:

- `config.json`;
- токены;
- OAuth credentials;
- локальные видеофайлы;
- большие бинарники без необходимости.

---

## Полезные ссылки

- [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases)
- [FFmpeg downloads](https://ffmpeg.org/download.html)
- [Windows FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [Electron](https://www.electronjs.org/)
- [Vue](https://vuejs.org/)
- [Vite](https://vitejs.dev/)

---

## Лицензии сторонних инструментов

YTReUp использует внешние инструменты:

- `yt-dlp`
- `ffmpeg`

Перед публичным распространением сборки проверьте лицензии используемых бинарников и добавьте необходимые license-файлы в релиз.

---

## Автор

Created by **jalisco2213**.

---