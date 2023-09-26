# pm2-keep-alive
 
A hacky script to keep a naughty process alive in PM2 that doesn't want to auto restart and I don't currently have time to fix properly. 

## Requirements
1. Node V18+

## Setup

1. Clone this repo
2. `npm install`
3. `cp .env.example .env`
4. Edit `.env` to your liking
5. `pm2 start index.js --name pm2-keep-alive`

## Config
- `HEALTH_ENDPOINT` is the only required variable
- Leaving `PM2_COMMAND` blank will not execute anything on error
- Setting `INTERVAL_SECONDS` to `0` or nothing will run the script once and exit, if you wanted to instead run it only once or in cron
- `WEBHOOK_URL` sends a Discord webhook alert when an error is detected
