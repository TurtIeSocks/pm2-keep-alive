// @ts-check
import dotenv from 'dotenv'
import { promisify } from 'util'
import { exec } from 'child_process'

dotenv.config()

const execAsync = promisify(exec)
const setTimeoutAsync = promisify(setTimeout)

const INTERVAL_MS = (process.env.INTERVAL_SECONDS
  ? +process.env.INTERVAL_SECONDS
  : 0) * 1_000

const RETRIES = process.env.RETRIES ? +process.env.RETRIES : 3

const ENDPOINT = process.env.HEALTH_ENDPOINT

const COMMAND = process.env.PM2_COMMAND

const WEBHOOK = process.env.WEBHOOK_URL

if (!ENDPOINT) throw new Error('HEALTH_ENDPOINT is required')

/**
 * Wrapped around `fetch` with an abort controller and error catcher
 * @param {string} url
 * @param {RequestInit & { waitTime?: number }} [options]
 */
const fetchWrapper = async (
  url,
  { waitTime, ...options } = { waitTime: 1_000 }
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
 * @returns {Promise<{ isBad: boolean, attempt: number }>}
 */
const checkEndpoint = async () => {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      console.log(`Attempt:`, attempt, `Checking ${ENDPOINT}`)
      const resp = await fetchWrapper(ENDPOINT)
      if (resp.ok) {
        return { isBad: false, attempt }
      }
    } catch (e) {
      console.warn('Attempt:', attempt, e instanceof Error ? e.message : e)
    }
  }
  return { isBad: true, attempt: RETRIES }
}

if (INTERVAL_MS) {
  setInterval(
    async () => {
      const status = await checkEndpoint()
      if (status.isBad) {
        console.error('Bad health after', status.attempt, 'attempts, restarting')
        if (COMMAND) {
          await execAsync(COMMAND)
        }
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
      } else {
        console.log('Health is good, attempt:', status.attempt, 'of', RETRIES)
      }
    },
    INTERVAL_MS
  )
}
