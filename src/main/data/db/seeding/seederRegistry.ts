import type { ISeeder } from '../types'
import { AgentSessionContextSeeder } from './seeders/AgentSessionContextSeeder'
import { AgentSessionMessageTreeSeeder } from './seeders/AgentSessionMessageTreeSeeder'
import { BrowserCapabilityUpgradeSeeder } from './seeders/browserCapabilityUpgradeSeeder'
import { BuiltinMcpServerSeeder } from './seeders/builtinMcpServerSeeder'
import { CherryAssistantInstructionsUpgradeSeeder } from './seeders/CherryAssistantInstructionsUpgradeSeeder'
import { DefaultAssistantSeeder } from './seeders/defaultAssistantSeeder'
import { KnowledgeBaseOrderSeeder } from './seeders/knowledgeBaseOrderSeeder'
import { LegacyFileCleanupPolicySeeder } from './seeders/legacyFileCleanupPolicySeeder'
import { LocalModelSeeder } from './seeders/LocalModelSeeder'
import { LongTextPastePreferenceUpgradeSeeder } from './seeders/longTextPastePreferenceUpgradeSeeder'
import { MiniAppSeeder } from './seeders/miniAppSeeder'
import { PoeChatEndpointUpgradeSeeder } from './seeders/PoeChatEndpointUpgradeSeeder'
import { PreferenceSeeder } from './seeders/preferenceSeeder'
import { PresetProviderSeeder } from './seeders/presetProviderSeeder'
import { RetiredAgentRuntimeSeeder } from './seeders/RetiredAgentRuntimeSeeder'
import { SelectionActionItemsUpgradeSeeder } from './seeders/selectionActionItemsUpgradeSeeder'
import { SidebarShortcutMigrationSeeder } from './seeders/sidebarShortcutMigrationSeeder'
import { TranslateLanguageSeeder } from './seeders/translateLanguageSeeder'
import { WebSearchPreferenceUpgradeSeeder } from './seeders/WebSearchPreferenceUpgradeSeeder'

/**
 * All seeders in execution order.
 *
 * To add a new seeder: create an ISeeder class, add it to this array.
 * No changes to DbService needed.
 */
export const seeders: ISeeder[] = [
  new RetiredAgentRuntimeSeeder(),
  new AgentSessionContextSeeder(),
  new AgentSessionMessageTreeSeeder(),
  new KnowledgeBaseOrderSeeder(),
  new BrowserCapabilityUpgradeSeeder(),
  new LegacyFileCleanupPolicySeeder(),
  new PresetProviderSeeder(),
  new PoeChatEndpointUpgradeSeeder(),
  new CherryAssistantInstructionsUpgradeSeeder(),
  new DefaultAssistantSeeder(),
  new LongTextPastePreferenceUpgradeSeeder(),
  new WebSearchPreferenceUpgradeSeeder(),
  new SidebarShortcutMigrationSeeder(),
  new SelectionActionItemsUpgradeSeeder(),
  new PreferenceSeeder(),
  new TranslateLanguageSeeder(),
  new LocalModelSeeder(),
  new MiniAppSeeder(),
  new BuiltinMcpServerSeeder()
]
