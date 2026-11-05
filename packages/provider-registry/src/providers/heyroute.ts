import { openaiCompatible } from './types'

export default openaiCompatible({
  id: 'heyroute',
  name: 'HeyRoute',
  availableInEditions: ['global'],
  baseUrl: 'https://heyroute.ai/v1',
  website: { official: 'https://heyroute.ai' }
})
