import { calendar_v3 } from 'googleapis'

export const isTransparent: (event: calendar_v3.Schema$Event) => boolean = event => event.transparency === 'transparent'
