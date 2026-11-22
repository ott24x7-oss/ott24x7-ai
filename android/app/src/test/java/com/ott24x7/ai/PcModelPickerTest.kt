package com.ott24x7.ai

import com.ott24x7.ai.data.PanelCatalog
import com.ott24x7.ai.data.PanelKind
import com.ott24x7.ai.data.PcAgent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PcModelPickerTest {
    @Test
    fun pcAgentsBecomeSelectableYourPcPanels() {
        val panels = PanelCatalog.withEndpoints(emptyList(), listOf(PcAgent("codex", "Codex", pcId = "pc-1", pcName = "Office PC")))
        val pc = panels.single { it.kind == PanelKind.PC }
        assertEquals("pc:pc-1:codex", pc.id)
        assertEquals("Codex", pc.name)
        assertTrue(pc.pcAgent?.pcId == "pc-1")
    }
}
