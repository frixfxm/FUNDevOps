# TURN-сервер (coturn) на Ubuntu для голосовых звонков

Если звонки подключаются, но звука нет (ICE failed в chrome://webrtc-internals), нужен TURN: он ретранслирует медиа, когда прямой P2P между браузерами не устанавливается (NAT/файрвол).

## 1. Установка coturn

```bash
sudo apt update
sudo apt install coturn -y
```

## 2. Включить coturn

```bash
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
```

Или отредактируй вручную: `sudo nano /etc/default/coturn` и раскомментируй строку `TURNSERVER_ENABLED=1`.

## 3. Настроить конфиг

```bash
sudo nano /etc/turnserver.conf
```

Добавь или измени строки (подставь свой пароль и при необходимости realm):

```ini
listening-port=3478
fingerprint
lt-cred-mech
realm=your-domain.com
user=messenger:YOUR_SECRET_PASSWORD
```

- **realm** — домен или имя (можно `turn.local` или IP сервера).
- **user** — логин и пароль в формате `логин:пароль` (например `messenger:MyStr0ngPass`).

Сохрани файл (Ctrl+O, Enter, Ctrl+X).

## 4. Порты в фаерволе

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp
sudo ufw reload
```

Диапазон 49152–65535 UDP используется coturn для реле медиа.

## 5. Запуск coturn

```bash
sudo systemctl enable coturn
sudo systemctl start coturn
sudo systemctl status coturn
```

Должен быть `active (running)`.

## 6. Переменные для приложения

При сборке фронта нужно передать данные TURN (тот же логин и пароль, что в coturn).

**Вариант A — через .env в корне проекта (для Docker):**

В корне репозитория создай файл `.env` (рядом с `docker-compose.yml`):

```env
NEXT_PUBLIC_TURN_SERVER=turn:ТВОЙ_IP_ИЛИ_ДОМЕН:3478
NEXT_PUBLIC_TURN_USERNAME=messenger
NEXT_PUBLIC_TURN_CREDENTIAL=YOUR_SECRET_PASSWORD
```

Замени `ТВОЙ_IP_ИЛИ_ДОМЕН` на IP сервера (например `188.32.68.192`) или домен. Пароль — тот же, что в `user=...` в turnserver.conf.

**Вариант B — через frontend/.env при локальной разработке:**

В `frontend/.env` добавь те же три переменные.

## 7. Пересборка фронта (Docker)

После добавления переменных в `.env` в корне:

```bash
docker compose build frontend
docker compose up -d
```

Переменные подхватятся при сборке и попадут в код; звонки начнут использовать TURN, когда прямой путь недоступен.

## 8. Проверка

Позвони с двух устройств в разных сетях (например телефон и комп с другим интернетом). В chrome://webrtc-internals на вкладке с нужным PeerConnection можно увидеть использование relay (тип кандидата relay). Если звук пошёл — TURN работает.

## Устранение неполадок

- **Не подключается к TURN:** проверь, что порты 3478 и 49152–65535 UDP открыты на роутере/хостинге, если сервер за NAT.
- **Ошибки в логах:** `sudo journalctl -u coturn -n 50`.
- **Проверка порта:** `sudo ss -ulnp | grep 3478` — процесс должен слушать 3478.
