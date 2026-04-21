# ⚓ Melhiq Premium Safeguarding Bot

A high-performance, professional Telegram bot built for **EngenderHealth YAC**.

## 🌟 Premium Features

-   **Professional UX**: Uses HTML formatting, custom emojis, and a persistent keyboard menu.
-   **Step-by-Step Flow**: Guided 4-step reporting process with breadcrumbs.
-   **Animations**: Simulated "Processing" and "Securing" progress bars for a premium feel.
-   **Database Integration**: Securely saves every report to MongoDB with unique tracking IDs.
-   **Admin Alerts**: Real-time notifications for the safeguarding team (optional).
-   **Network Resilience**: Built-in support for HTTPS proxies to fix connection timeouts (`ETIMEDOUT`).

## 🛠️ Setup

### 1. Requirements
-   **Node.js** (v18+)
-   **MongoDB** (Local or Atlas)
-   **Telegram Bot Token** (from [@BotFather](https://t.me/botfather))

### 2. Installation
```bash
cd telegram-bot
npm install
```

### 3. Configuration
Rename/Edit the `.env` file:
```env
BOT_TOKEN=your_token_here
MONGODB_URI=mongodb://localhost:27017/melhiq_bot
ADMIN_CHAT_ID=your_telegram_id_here
```

### 4. Running
```bash
node bot.js
```

## 🔌 Troubleshooting ETIMEDOUT
If you get a connection timeout error, your network might be blocking Telegram's API. 

1.  **Check Internet**: Ensure you can reach [api.telegram.org](https://api.telegram.org).
2.  **Use a Proxy**: If you use a VPN or proxy (like Clash, V2Ray, etc.), add the proxy URL to your `.env`:
    ```env
    HTTPS_PROXY=http://127.0.0.1:7890
    ```

## 🏗️ Architecture
-   **Telegraf**: Modern Telegram Bot Framework.
-   **Mongoose**: Elegant MongoDB object modeling.
-   **Luxon**: Powerful date and time handling.
-   **Https-Proxy-Agent**: Connectivity fix for restricted networks.
