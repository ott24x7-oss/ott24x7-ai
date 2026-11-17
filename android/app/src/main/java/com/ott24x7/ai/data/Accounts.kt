package com.ott24x7.ai.data

enum class PanelLoginStatus(val storageValue: String) {
    SIGNED_IN("signed-in"),
    SIGNED_OUT("signed-out"),
    UNKNOWN("unknown"),
    CHECKING("checking");

    companion object {
        fun fromStorage(value: String?): PanelLoginStatus = when (value) {
            SIGNED_IN.storageValue -> SIGNED_IN
            SIGNED_OUT.storageValue -> SIGNED_OUT
            CHECKING.storageValue -> CHECKING
            else -> UNKNOWN
        }
    }
}

class PanelLoginStatusStore(
    private val read: (String) -> String?,
    private val write: (String, String) -> Unit
) {
    fun load(panelId: String): PanelLoginStatus = PanelLoginStatus.fromStorage(read(key(panelId)))

    fun save(panelId: String, status: PanelLoginStatus) {
        write(key(panelId), status.storageValue)
    }

    private fun key(panelId: String) = "panel_login_status_$panelId"
}

object AccountsWelcomeState {
    fun shouldShow(hasBeenSeen: Boolean): Boolean = !hasBeenSeen
}
