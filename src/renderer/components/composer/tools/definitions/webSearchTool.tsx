import { defineTool } from '@renderer/components/composer/tools/types'

import { WebSearchToolRuntime } from '../components/WebSearchButton'
import { WEB_SEARCH_TOOLBAR_MANIFEST } from '../toolbarManifests'

/**
 * Web Search Tool
 *
 * Toggles assistant web search in Chat and a persisted Compare flag when the
 * composer sends to externally selected models.
 */
const webSearchTool = defineTool({
  key: 'web_search',
  label: WEB_SEARCH_TOOLBAR_MANIFEST.label,

  visibleInScopes: WEB_SEARCH_TOOLBAR_MANIFEST.visibleInScopes,

  availableWhenModelOptional: true,
  condition: ({ assistant, modelOptional }) => Boolean(assistant || modelOptional),
  composer: {
    runtime: ({ context }) => <WebSearchToolRuntime assistantId={context.assistant?.id} launcher={context.launcher} />
  }
})

export default webSearchTool
