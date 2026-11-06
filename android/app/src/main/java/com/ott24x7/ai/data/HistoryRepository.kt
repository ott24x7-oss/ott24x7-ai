package com.ott24x7.ai.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.historyDataStore by preferencesDataStore(name = "ott24x7_history")

class HistoryRepository(context: Context) {
    private val store = context.applicationContext.historyDataStore
    private val turnsKey = stringPreferencesKey("turns")

    val turns: Flow<List<HistoryTurn>> = store.data.map { preferences ->
        HistoryStoreCodec.decode(preferences[turnsKey].orEmpty())
    }
    val hasStoredTurns: Flow<Boolean> = store.data.map { preferences -> preferences.contains(turnsKey) }

    suspend fun save(turns: List<HistoryTurn>) {
        store.edit { preferences -> preferences[turnsKey] = HistoryStoreCodec.encode(turns) }
    }
}
