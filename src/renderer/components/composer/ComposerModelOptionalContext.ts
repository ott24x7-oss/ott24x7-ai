import { createContext, useContext } from 'react'

/**
 * True when the composer sends to models chosen elsewhere (Compare columns), so tools
 * must not gate themselves on the assistant's own model.
 */
export const ComposerModelOptionalContext = createContext(false)

export const useComposerModelOptional = () => useContext(ComposerModelOptionalContext)
