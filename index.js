// @ts-check
import dotenv from 'dotenv'
import { promisify } from 'util'
import { exec } from 'child_process'

dotenv.config()

const INTERVAL_SECONDS = process.env.INTERVAL_SECONDS
  ? +process.env.INTERVAL_SECONDS
  : 0

const ENDPOINT = process.env.HEALTH_ENDPOINT

const COMMAND = process.env.PM2_COMMAND

const WEBHOOK = process.env.WEBHOOK_URL

if (!ENDPOINT) throw new Error('HEALTH_ENDPOINT is required')

const execAsync = promisify(exec)

/**
 * Wrapped around `fetch` with an abort controller and error catcher
 * @param {string} url
 * @param {RequestInit & { waitTime?: number }} [options]
 */
const fetchWrapper = async (
  url,
  { waitTime, ...options } = { waitTime: 5000 }
) => {
  const signal = new AbortController()
  const timeout = setTimeout(() => signal.abort(), waitTime)
  try {
    const res = await fetch(url, {
      ...options,
      signal: signal.signal,
    })
    return res
  } catch (e) {
    console.error(e)
    return { status: 500, ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Simply checks whether the endpoint returns a 200
 * @returns {Promise<boolean>}
 */
const isBad = async () => {
  try {
    console.log(`Checking ${ENDPOINT}`)
    const resp = await fetchWrapper(ENDPOINT)
    return !resp.ok
  } catch (e) {
    return true
  }
}

if (INTERVAL_SECONDS) {
  setInterval(
    () =>
      isBad().then((bad) => {
        if (bad) {
          console.error('Bad health, restarting')
          if (COMMAND) execAsync(COMMAND)
          if (WEBHOOK)
            fetchWrapper(WEBHOOK, {
              waitTime: 5000,
              method: 'POST',
              headers: {
                'Content-type': 'application/json',
              },
              body: JSON.stringify({
                content: null,
                embeds: [
                  {
                    title: 'Bad Health Detected',
                    color: 0xff0000,
                    description: `Command: \`${COMMAND}\``,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }),
            })
        }
      }),
    INTERVAL_SECONDS * 1000
  )
}
