import type { AxiosInstance } from 'axios'
import axios from 'axios'

import { logger } from '@/lib/tools/logger'

// Used by the client to communicate with NextJS API
let api: AxiosInstance

export const getNextApiClient = (): AxiosInstance => {
  if (!api) {
    api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_HOST_BASE_URL,
      timeout: 50000,
    })

    api.interceptors.request.use(request => {
      logger('log', 'Starting Request', { baseUrl: request.baseURL, method: request.method, url: request.url, data: request.data })
      return request
    })
  }

  return api
}
