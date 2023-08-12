import type { AxiosInstance } from 'axios'
import axios from 'axios'

import { logger } from '@/lib/tools/logger'

let api: AxiosInstance

export const getTaskSchedulerClient = (): AxiosInstance => {
  if (!api) {
    api = axios.create({
      baseURL: process.env.TASK_SCHEDULER_URL,
      timeout: 50000,
    })

    console.log(api)

    api.interceptors.request.use(request => {
      logger('log', 'Starting Request', { baseUrl: request.baseURL, method: request.method, url: request.url, data: request.data })
      return request
    })
  }

  return api
}
