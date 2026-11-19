<div align="center">

# Noir для iPhone

**Чёрно-белый плеер Яндекс Музыки и пульт для компьютера**

Мобильная версия [Noir](https://github.com/trualontuu/player) для Windows: волна, лайки, скачивание и управление плеером на ПК с телефона.

[![Добавить в SideStore](https://img.shields.io/badge/Добавить_в_SideStore-источник-f2f2f2?style=for-the-badge&logo=apple&logoColor=111&labelColor=f2f2f2&color=111)](https://noir-ios.pages.dev/source.json)
&nbsp;
[![Скачать .ipa](https://img.shields.io/badge/Скачать-Noir.ipa-111?style=for-the-badge&logo=apple&logoColor=white&labelColor=111&color=333)](https://noir-ios.pages.dev/Noir.ipa)

![Expo SDK 58](https://img.shields.io/badge/Expo-SDK_58-111?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-111?style=flat-square&logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-111?style=flat-square&logo=typescript&logoColor=3178c6)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-111?style=flat-square&logo=cloudflare&logoColor=f38020)
![iOS 26](https://img.shields.io/badge/iOS-26-111?style=flat-square&logo=apple&logoColor=white)

<img src=".github/assets/noir-ios.png" alt="Noir для iPhone: Моя волна, плеер и пульт для компьютера" width="900">

<sub>Макет: треки и обложки выдуманные.</sub>

</div>

## Установка

Noir нет в App Store, поэтому ставится он как своё приложение — через **SideStore** или **Sideloadly** с обычным бесплатным Apple ID. Платить не нужно, Mac не нужен.

### Через SideStore — рекомендуется

Ставится один раз с компьютера, а потом всё делается прямо на телефоне, и подпись продлевается сама.

1. Установи **SideStore** по [официальной инструкции](https://docs.sidestore.io/docs/installation/prerequisites). Для этого один раз понадобятся компьютер и кабель.
2. Открой в SideStore вкладку **Sources** → **+** и вставь адрес:
   ```
   https://noir-ios.pages.dev/source.json
   ```
3. Выбери **Noir** → **Install**.
4. На айфоне: **Настройки → Основные → VPN и управление устройством** → свой Apple ID → **Доверять**.
5. Открой Noir и войди по коду с **ya.ru/device**.

Обновления появятся в SideStore сами, а мелкие приходят прямо в приложение по воздуху.

### Через Sideloadly — с компьютера

1. Скачай **[Noir.ipa](https://noir-ios.pages.dev/Noir.ipa)** и поставь [Sideloadly](https://sideloadly.io) (Windows или Mac).
2. Подключи айфон кабелем, перетащи `Noir.ipa` в окно Sideloadly, введи Apple ID и нажми **Start**.
3. Дальше как в шагах 4–5 выше.

С бесплатным Apple ID подпись живёт **7 дней**. Потом приложение перестаёт открываться, и его нужно переподписать: в SideStore это кнопка **Refresh**, в Sideloadly — повторить шаг 2. Данные и скачанные треки при этом сохраняются.

<details>
<summary><b>SideStore пишет «The request timed out» при добавлении источника</b></summary>

Это сетевая проблема самого SideStore. Скачай [Noir.ipa](https://noir-ios.pages.dev/Noir.ipa) в Safari, затем в SideStore открой **My Apps** → **+** и выбери файл из «Загрузок».
</details>

<details>
<summary><b>«Ненадёжный разработчик» или приложение не открывается</b></summary>

Сделай шаг 4: **Настройки → Основные → VPN и управление устройством** → свой Apple ID → **Доверять**. На iOS 16 и новее ещё нужно включить **Настройки → Конфиденциальность и безопасность → Режим разработчика** и перезагрузить телефон.
</details>

<details>
<summary><b>Как управлять компьютером</b></summary>

Установи [Noir для Windows](https://github.com/trualontuu/player) и войди тем же аккаунтом Яндекса. Пока он открыт, на вкладке «Моё» появится карточка компьютера, а мини-плеер станет пультом. Кнопки громкости айфона в это время меняют громкость на ПК. Компьютер и телефон могут быть в разных сетях.
</details>

<details>
<summary><b>Почему не App Store</b></summary>

Для App Store и TestFlight нужен платный аккаунт разработчика (99 $ в год), а неофициальный клиент чужого сервиса туда, скорее всего, не пропустят.
</details>

## Что умеет

| | |
|---|---|
| 🌊 **Моя волна** | характер, настроение и свои сцены: «CS2» и «В дороге», где волна собрана от выбранных артистов. Отзывы о треках уходят в Яндекс, как в официальном приложении |
| 💿 **Вся медиатека** | «Мне нравится», плейлисты, альбомы, артисты и поиск. Долгое нажатие на трек: «играть следующим», лайк, скачать, перейти к артисту или альбому |
| ⬇️ **Без интернета** | скачивание по одному треку или целым плейлистом |
| 🔒 **Фон и локскрин** | карточка в Пункте управления и кнопки наушников. Следующий трек включает сама iOS через `AVQueuePlayer`, приложению не нужно просыпаться |
| 🎚️ **Плавный переход** | затухание и нарастание между треками (от 0 до 10 с), пауза без щелчка, **ровная громкость** по LUFS |
| 💻 **Пульт для ПК** | как Spotify Connect: пауза, треки, лайк, перемотка, громкость, в том числе кнопками айфона. Работает и не из одной сети |
| ✨ **Обновления по воздуху** | EAS Update: новые версии интерфейса приходят сами, без переустановки |
| 🎨 **Цвет из обложки** | кнопки и свечение фона берутся из играющего трека, есть строгий ч/б режим |
| 🔑 **Безопасный вход** | по коду с ya.ru/device, пароль приложение не видит. Токен хранится в Keychain |

## Как устроен пульт

```
Noir на ПК (host) ──┐                              ┌── Noir на iPhone (remote)
                    └─ wss ─► Noir Connect ◄─ wss ─┘
                              Cloudflare Worker + Durable Object
```

Комната одна на аккаунт Яндекса. Ретранслятор по токену из заголовка спрашивает у Яндекса uid и кладёт соединение в Durable Object этого uid. Сам токен он не хранит, а в памяти держит только sha-256 от него. Компьютер присылает состояние (трек, позиция, громкость), телефон присылает команды. Код ретранслятора лежит в [`connect/`](connect).

## Для разработчиков

<details>
<summary><b>Запуск и проверки</b></summary>

```
npm install
npx expo start          # Expo Go на iPhone по QR-коду (кроме кнопок громкости → ПК: им нужна своя сборка)
npm run typecheck
npx eslint src
```
</details>

<details>
<summary><b>Сборка ipa без Mac</b></summary>

GitHub → Actions → **iOS build** → *Run workflow*. Примерно через 25 минут в артефактах появится `Noir.ipa` без подписи — её подписывают SideStore или Sideloadly при установке.

Выкладка:
- `scripts/ota.ps1 -Message "…"` — изменения в JS приходят по воздуху во все установленные копии той же версии;
- `scripts/publish-ipa.ps1` — выкладывает свежую ipa в источник SideStore. Нужен при изменениях в нативных модулях, вместе с повышением `version`.
</details>

---

<div align="center"><sub>Noir — неофициальный клиент. Он не связан с Яндексом и не обходит защиту контента.</sub></div>
