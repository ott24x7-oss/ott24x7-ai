package com.ott24x7.ai.data

import android.util.Base64
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.Security
import java.util.UUID

data class PairingEndpoint(val host: String, val port: Int, val security: String)

data class PairingQr(
    val name: String,
    val desktopIdentity: String,
    val invitationId: String,
    val invitationSecret: String,
    val protocolVersions: List<Int>,
    val endpoints: List<PairingEndpoint>
)

object PairingQrParser {
    fun parse(payload: String): PairingQr {
        val root = runCatching { JSONObject(payload.trim()) }.getOrElse { throw IllegalArgumentException("Invalid pairing code") }
        if (root.optString("t") != "ott24x7ai-pair") throw IllegalArgumentException("Invalid pairing code")
        val name = required(root, "name", 128)
        val desktopIdentity = required(root, "desktopIdentity", 256)
        val invitationId = required(root, "invitationId", 256)
        val invitationSecret = required(root, "invitationSecret", 256)
        val versions = root.optJSONArray("protocolVersions")?.let { array ->
            if (array.length() !in 1..16) null else (0 until array.length()).map { array.getInt(it).also { value -> require(value > 0) } }
        } ?: throw IllegalArgumentException("Invalid protocol versions")
        val endpoints = when (root.optInt("v", -1)) {
            2 -> {
                val ips = root.optJSONArray("ips") ?: throw IllegalArgumentException("Invalid pairing endpoints")
                val port = root.optInt("port", -1)
                if (ips.length() !in 1..32 || port !in 1..65535) throw IllegalArgumentException("Invalid pairing endpoints")
                (0 until ips.length()).map { index ->
                    val host = ips.getString(index)
                    if (!isIpAddress(host)) throw IllegalArgumentException("Invalid pairing endpoint")
                    PairingEndpoint(host, port, "ws")
                }
            }
            3 -> {
                val values = root.optJSONArray("endpoints") ?: throw IllegalArgumentException("Invalid pairing endpoints")
                if (values.length() !in 1..32) throw IllegalArgumentException("Invalid pairing endpoints")
                (0 until values.length()).map { index ->
                    val endpoint = values.getJSONObject(index)
                    val host = endpoint.optString("host")
                    val port = endpoint.optInt("port", -1)
                    val security = endpoint.optString("security")
                    if (!isHost(host) || port !in 1..65535 || security !in setOf("ws", "wss")) {
                        throw IllegalArgumentException("Invalid pairing endpoint")
                    }
                    PairingEndpoint(host.lowercase(), port, security)
                }
            }
            else -> throw IllegalArgumentException("Unsupported pairing code")
        }
        return PairingQr(name, desktopIdentity, invitationId, invitationSecret, versions, endpoints)
    }

    private fun required(root: JSONObject, key: String, maxLength: Int): String = root.optString(key).takeIf { it.isNotBlank() && it.length <= maxLength }
        ?: throw IllegalArgumentException("Invalid pairing code")

    private fun isIpAddress(value: String): Boolean = isIpv4(value) || isIpv6(value)

    private fun isIpv4(value: String): Boolean {
        val parts = value.split('.')
        return parts.size == 4 && parts.all { part -> part.isNotEmpty() && part.length <= 3 && part.all(Char::isDigit) && part.toIntOrNull() in 0..255 }
    }

    private fun isIpv6(value: String): Boolean = value.contains(':') && value.length <= 45 && value.matches(Regex("^[0-9a-fA-F:.]+$")) &&
        runCatching { java.net.InetAddress.getByName(value) is java.net.Inet6Address }.getOrDefault(false)

    private fun isHost(value: String): Boolean {
        if (value.isBlank() || value.length > 253 || value.any { it == '@' || it == '/' || it == '\\' }) return false
        return isIpAddress(value) || value.matches(Regex("^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"))
    }
}

data class PairedPc(
    val id: String,
    val name: String,
    val deviceId: String,
    val accessToken: String,
    val expiresAt: String,
    val desktopIdentity: String,
    val endpoints: List<PairingEndpoint>,
    val lastSyncAt: Long,
    val importedProviderIds: List<String> = emptyList(),
    val capabilities: List<String> = listOf("configuration")
)

object PairedPcCodec {
    fun encode(values: List<PairedPc>): String = JSONArray().apply {
        values.forEach { pc ->
            put(JSONObject().apply {
                put("id", pc.id)
                put("name", pc.name)
                put("deviceId", pc.deviceId)
                put("accessToken", pc.accessToken)
                put("expiresAt", pc.expiresAt)
                put("desktopIdentity", pc.desktopIdentity)
                put("lastSyncAt", pc.lastSyncAt)
                put("importedProviderIds", JSONArray(pc.importedProviderIds))
                put("capabilities", JSONArray(pc.capabilities))
                put("endpoints", JSONArray().apply {
                    pc.endpoints.forEach { endpoint ->
                        put(JSONObject().put("host", endpoint.host).put("port", endpoint.port).put("security", endpoint.security))
                    }
                })
            })
        }
    }.toString()

    fun decode(value: String): List<PairedPc> = runCatching {
        val array = JSONArray(value)
        (0 until array.length()).mapNotNull { index ->
            val row = array.optJSONObject(index) ?: return@mapNotNull null
            val endpoints = row.optJSONArray("endpoints") ?: JSONArray()
            val imported = row.optJSONArray("importedProviderIds") ?: JSONArray()
            val capabilities = row.optJSONArray("capabilities") ?: JSONArray().put("configuration")
            PairedPc(
                id = row.optString("id").ifBlank { row.optString("deviceId") },
                name = row.optString("name"),
                deviceId = row.optString("deviceId"),
                accessToken = row.optString("accessToken"),
                expiresAt = row.optString("expiresAt"),
                desktopIdentity = row.optString("desktopIdentity"),
                endpoints = (0 until endpoints.length()).mapNotNull { endpointIndex ->
                    endpoints.optJSONObject(endpointIndex)?.let { endpoint ->
                        PairingEndpoint(endpoint.optString("host"), endpoint.optInt("port"), endpoint.optString("security"))
                    }
                },
                lastSyncAt = row.optLong("lastSyncAt"),
                importedProviderIds = (0 until imported.length()).map { imported.optString(it) }.filter(String::isNotBlank),
                capabilities = (0 until capabilities.length()).map { capabilities.optString(it) }.filter(String::isNotBlank)
            ).takeIf { it.id.isNotBlank() && it.deviceId.isNotBlank() && it.accessToken.isNotBlank() }
        }
    }.getOrDefault(emptyList())
}

data class ExportModel(val id: String, val apiModelId: String, val name: String, val enabled: Boolean)

data class ExportProvider(
    val id: String,
    val name: String,
    val baseUrl: String,
    val apiKey: String,
    val models: List<ExportModel>,
    val supported: Boolean
) {
    val hasKey: Boolean get() = apiKey.isNotBlank()

    fun toEndpoints(deviceId: String): List<ApiEndpoint> = if (!supported) emptyList() else models.map { model ->
        val modelId = model.apiModelId.ifBlank { model.id }
        ApiEndpoint(
            id = "paired:$deviceId:$id:$modelId",
            name = if (models.size == 1) name else "$name · ${model.name.ifBlank { modelId }}",
            baseUrl = baseUrl,
            apiKey = apiKey,
            modelId = modelId,
            pairedDeviceId = deviceId
        )
    }
}

data class ProviderExport(val providers: List<ExportProvider>)

object ProviderExportCodec {
    fun decode(bytes: ByteArray): ProviderExport {
        val root = runCatching { JSONObject(String(bytes, StandardCharsets.UTF_8)) }.getOrElse { throw IllegalArgumentException("Invalid provider export") }
        if (root.optInt("version", -1) != 1) throw IllegalArgumentException("Unsupported provider export")
        val providers = root.optJSONArray("providers") ?: JSONArray()
        return ProviderExport((0 until providers.length()).mapNotNull { index -> parseProvider(providers.optJSONObject(index)) })
    }

    private fun parseProvider(provider: JSONObject?): ExportProvider? {
        if (provider == null) return null
        val endpointConfigs = provider.optJSONObject("endpointConfigs")
        val chatConfig = endpointConfigs?.optJSONObject("openai-chat-completions")
        val baseUrl = chatConfig?.optString("baseUrl").orEmpty()
        val keys = provider.optJSONArray("apiKeys") ?: JSONArray()
        val apiKey = (0 until keys.length()).asSequence().mapNotNull { index ->
            keys.optJSONObject(index)?.takeIf { it.optBoolean("isEnabled", true) }?.optString("key")?.takeIf(String::isNotBlank)
        }.firstOrNull().orEmpty()
        val modelArray = provider.optJSONArray("models") ?: JSONArray()
        val models = (0 until modelArray.length()).mapNotNull { index ->
            modelArray.optJSONObject(index)?.let { model ->
                ExportModel(
                    id = model.optString("id"),
                    apiModelId = model.optString("apiModelId"),
                    name = model.optString("name"),
                    enabled = model.optBoolean("isEnabled", true) && !model.optBoolean("isHidden", false)
                )
            }
        }.filter { it.enabled && it.apiModelId.isNotBlank() || it.enabled && it.id.isNotBlank() }
        return ExportProvider(
            id = provider.optString("id").ifBlank { UUID.randomUUID().toString() },
            name = provider.optString("name").ifBlank { provider.optString("id") },
            baseUrl = baseUrl,
            apiKey = apiKey,
            models = models,
            supported = baseUrl.isNotBlank() && models.isNotEmpty()
        )
    }
}

class PairingIdentity private constructor(private val seed: ByteArray, val publicKey: ByteArray) {
    companion object {
        fun create(): PairingIdentity {
            ensureProvider()
            val seed = ByteArray(32)
            java.security.SecureRandom().nextBytes(seed)
            return fromSeed(seed)
        }

        fun fromSeed(seed: ByteArray): PairingIdentity {
            require(seed.size == 32)
            ensureProvider()
            val publicKey = Ed25519PrivateKeyParameters(seed, 0).generatePublicKey().encoded
            return PairingIdentity(seed.copyOf(), publicKey)
        }

        private fun ensureProvider() {
            if (Security.getProvider("BC") == null) Security.addProvider(BouncyCastleProvider())
        }
    }

    fun seedBytes(): ByteArray = seed.copyOf()

    fun sign(message: ByteArray): ByteArray = org.bouncycastle.crypto.signers.Ed25519Signer().run {
        init(true, Ed25519PrivateKeyParameters(seed, 0))
        update(message, 0, message.size)
        generateSignature()
    }

    fun identityPublicKeyProtobuf(): ByteArray = byteArrayOf(0x08, 0x01, 0x12, 0x20) + publicKey

    fun identityPrivateKeyProtobuf(): ByteArray = byteArrayOf(0x08, 0x01, 0x12, 0x40) + seed + publicKey

    fun peerId(): String {
        val key = identityPublicKeyProtobuf()
        return base58Encode(byteArrayOf(0x00, key.size.toByte()) + key)
    }
}

private const val BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

private fun base58Encode(bytes: ByteArray): String {
    if (bytes.isEmpty()) return ""
    val digits = IntArray(bytes.size * 2)
    var size = 1
    bytes.forEach { byte ->
        var carry = byte.toInt() and 0xff
        var index = 0
        while (index < size) {
            val value = digits[index] * 256 + carry
            digits[index] = value % 58
            carry = value / 58
            index++
        }
        while (carry > 0) {
            digits[size++] = carry % 58
            carry /= 58
        }
    }
    val leadingZeroes = bytes.takeWhile { it == 0.toByte() }.count()
    return buildString(leadingZeroes + size) {
        repeat(leadingZeroes) { append(BASE58[0]) }
        for (index in size - 1 downTo 0) append(BASE58[digits[index]])
    }
}

fun base64Encode(value: ByteArray): String = Base64.encodeToString(value, Base64.NO_WRAP)

fun base64Decode(value: String): ByteArray = Base64.decode(value, Base64.DEFAULT)
