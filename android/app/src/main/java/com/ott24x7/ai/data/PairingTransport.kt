package com.ott24x7.ai.data

import android.os.Build
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.suspendCancellableCoroutine
import okio.ByteString
import org.bouncycastle.crypto.agreement.X25519Agreement
import org.bouncycastle.crypto.modes.ChaCha20Poly1305
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class PairingApproval(val verificationCode: String, val expiresAt: String)

data class PairingSessionResult(val pairedPc: PairedPc, val export: ProviderExport)

class PairingUnavailableException : Exception()
class PairingRejectedException : Exception()
class PairingExpiredException : Exception()
class PairingProtocolException : Exception()

class PairingClient(
    private val identity: PairingIdentity,
    private val deviceName: String = Build.MODEL.ifBlank { "Android phone" },
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
) {
    suspend fun pair(
        qr: PairingQr,
        onApproval: (PairingApproval) -> Unit = {},
        onApproved: (PairedPc) -> Unit = {}
    ): PairingSessionResult {
        var lastFailure: Throwable? = null
        qr.endpoints.forEach { endpoint ->
            try {
                return pairAt(endpoint, qr, onApproval, onApproved)
            } catch (error: CancellationException) {
                throw error
            } catch (error: PairingRejectedException) {
                throw error
            } catch (error: PairingExpiredException) {
                throw error
            } catch (error: Throwable) {
                lastFailure = error
            }
        }
        throw PairingUnavailableException().apply { initCause(lastFailure) }
    }

    suspend fun sync(pc: PairedPc): PairingSessionResult {
        var lastFailure: Throwable? = null
        pc.endpoints.forEach { endpoint ->
            try {
                return syncAt(endpoint, pc)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                lastFailure = error
            }
        }
        throw PairingUnavailableException().apply { initCause(lastFailure) }
    }

    private suspend fun pairAt(
        endpoint: PairingEndpoint,
        qr: PairingQr,
        onApproval: (PairingApproval) -> Unit,
        onApproved: (PairedPc) -> Unit
    ): PairingSessionResult {
        val channel = SecureRemoteChannel.open(httpClient, endpoint)
        try {
            val secure = channel.handshake(identity, qr.desktopIdentity, qr.protocolVersions)
            secure.call("connection.hello", JSONObject().put("protocolVersions", JSONArray(qr.protocolVersions)))
            val claim = secure.call("pairing.claim", JSONObject()
                .put("invitationId", qr.invitationId)
                .put("invitationSecret", qr.invitationSecret)
                .put("deviceName", deviceName)
                .put("platform", "android")
                .put("capabilities", JSONArray().put("configuration")))
            val claimId = claim.optString("claimId").takeIf(String::isNotBlank) ?: throw PairingProtocolException()
            val approval = PairingApproval(claim.optString("verificationCode"), claim.optString("expiresAt"))
            if (!approval.verificationCode.matches(Regex("^[0-9]{6}$"))) throw PairingProtocolException()
            onApproval(approval)
            val approved = waitForApproval(secure, claimId, approval.expiresAt)
            val pc = PairedPc(
                id = approved.optString("deviceId"),
                name = qr.name,
                deviceId = approved.optString("deviceId"),
                accessToken = approved.optString("accessToken"),
                expiresAt = approved.optString("expiresAt"),
                desktopIdentity = qr.desktopIdentity,
                endpoints = qr.endpoints,
                lastSyncAt = System.currentTimeMillis()
            )
            if (pc.id.isBlank() || pc.accessToken.isBlank()) throw PairingProtocolException()
            onApproved(pc)
            return PairingSessionResult(pc, readExport(secure))
        } finally {
            channel.close()
        }
    }

    private suspend fun syncAt(endpoint: PairingEndpoint, pc: PairedPc): PairingSessionResult {
        val channel = SecureRemoteChannel.open(httpClient, endpoint)
        try {
            val secure = channel.handshake(identity, pc.desktopIdentity, listOf(1))
            secure.call("connection.hello", JSONObject().put("protocolVersions", JSONArray().put(1)))
            val auth = secure.call("connection.authenticate", JSONObject().put("deviceId", pc.deviceId).put("accessToken", pc.accessToken))
            val refreshed = runCatching { secure.call("connection.refresh", JSONObject()) }.getOrNull() ?: auth
            val updated = pc.copy(
                accessToken = refreshed.optString("accessToken").ifBlank { auth.optString("accessToken") },
                expiresAt = refreshed.optString("expiresAt").ifBlank { auth.optString("expiresAt") },
                lastSyncAt = System.currentTimeMillis()
            )
            return PairingSessionResult(updated, readExport(secure))
        } finally {
            channel.close()
        }
    }

    private suspend fun waitForApproval(channel: SecureNoiseChannel, claimId: String, expiresAt: String): JSONObject {
        val deadline = runCatching { java.time.Instant.parse(expiresAt).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
        while (System.currentTimeMillis() < deadline) {
            val response = channel.call("pairing.get", JSONObject().put("claimId", claimId))
            when (response.optString("status")) {
                "approved" -> return response
                "rejected" -> throw PairingRejectedException()
                "expired" -> throw PairingExpiredException()
            }
            delay(minOf(2_000L, (deadline - System.currentTimeMillis()).coerceAtLeast(1L)))
        }
        throw PairingExpiredException()
    }

    private suspend fun readExport(channel: SecureNoiseChannel): ProviderExport {
        val prepared = channel.call("configuration.export.prepare", JSONObject())
        val exportId = prepared.optString("exportId").takeIf(String::isNotBlank) ?: throw PairingProtocolException()
        val expectedLength = prepared.optString("byteLength").toLongOrNull() ?: throw PairingProtocolException()
        val expectedHash = prepared.optString("sha256")
        val bytes = java.io.ByteArrayOutputStream(expectedLength.toInt().coerceAtMost(1_048_576))
        var offset = 0L
        var eof = false
        while (!eof) {
            val chunk = channel.call("configuration.export.read", JSONObject()
                .put("exportId", exportId)
                .put("offset", offset.toString())
                .put("maxBytes", 24_576))
            if (chunk.optString("exportId") != exportId || chunk.optString("offset").toLongOrNull() != offset) throw PairingProtocolException()
            val data = base64Decode(chunk.optString("dataBase64"))
            bytes.write(data)
            val nextOffset = chunk.optString("nextOffset").toLongOrNull() ?: throw PairingProtocolException()
            if (nextOffset != offset + data.size) throw PairingProtocolException()
            offset = nextOffset
            eof = chunk.optBoolean("eof")
            if (offset > expectedLength) throw PairingProtocolException()
        }
        val payload = bytes.toByteArray()
        if (payload.size.toLong() != expectedLength || sha256Hex(payload) != expectedHash) throw PairingProtocolException()
        return ProviderExportCodec.decode(payload)
    }
}

private class SecureRemoteChannel private constructor(private val socket: RemoteSocket) {
    companion object {
        suspend fun open(client: OkHttpClient, endpoint: PairingEndpoint): SecureRemoteChannel {
            val url = endpointUrl(endpoint)
            val socket = RemoteSocket.open(client, url)
            return SecureRemoteChannel(socket)
        }

        private fun endpointUrl(endpoint: PairingEndpoint): String {
            val host = if (endpoint.host.contains(':')) "[${endpoint.host}]" else endpoint.host
            return "${endpoint.security}://$host:${endpoint.port}/v1/remote/connect"
        }
    }

    suspend fun handshake(identity: PairingIdentity, expectedRemoteIdentity: String, protocolVersions: List<Int>): SecureNoiseChannel {
        val offer = JSONObject().put("protocolVersions", JSONArray(protocolVersions)).toString().toByteArray(StandardCharsets.UTF_8)
        val prelude = VarintFramedSocket(socket)
        prelude.write(offer)
        val selected = JSONObject(String(prelude.read(), StandardCharsets.UTF_8)).optInt("protocolVersion", -1)
        if (selected !in protocolVersions) throw PairingProtocolException()
        return NoiseXXInitiator(identity, expectedRemoteIdentity, selected, protocolVersions, FramedSocket(socket)).run()
    }

    fun close() = socket.close()
}

private class SecureNoiseChannel(
    private val framed: FramedSocket,
    private val outgoing: NoiseCipher,
    private val incoming: NoiseCipher
) {
    private var nextId = 1
    private var applicationPending = ByteArray(0)

    suspend fun call(method: String, params: JSONObject): JSONObject {
        val id = (nextId++).toString()
        val request = JSONObject().put("jsonrpc", "2.0").put("id", id).put("method", method).put("params", params)
        val record = request.toString().toByteArray(StandardCharsets.UTF_8)
        framed.write(outgoing.encrypt(encodeVarint(record.size) + record))
        while (true) {
            val value = JSONObject(String(readRecord(), StandardCharsets.UTF_8))
            if (value.optString("id") != id) continue
            if (value.has("error")) throw PairingProtocolException()
            return value.optJSONObject("result") ?: throw PairingProtocolException()
        }
    }

    private suspend fun readRecord(): ByteArray {
        while (true) {
            val parsed = readVarintFrame(applicationPending)
            if (parsed != null) {
                applicationPending = parsed.second
                return parsed.first
            }
            applicationPending += incoming.decrypt(framed.read())
        }
    }
}

private class NoiseXXInitiator(
    private val identity: PairingIdentity,
    private val expectedRemoteIdentity: String,
    private val selectedVersion: Int,
    private val offeredVersions: List<Int>,
    private val framed: FramedSocket
) {
    suspend fun run(): SecureNoiseChannel {
        val protocolName = "Noise_XX_25519_ChaChaPoly_SHA256".toByteArray(StandardCharsets.UTF_8)
        var hash = if (protocolName.size <= 32) ByteArray(32).also { protocolName.copyInto(it) } else sha256(protocolName)
        var chainingKey = hash.copyOf()
        val prologue = "{\"profile\":\"cherry-remote-noise-xx-v1\",\"protocolVersions\":[${offeredVersions.joinToString(",")}],\"protocolVersion\":$selectedVersion}".toByteArray(StandardCharsets.UTF_8)
        hash = sha256(hash + prologue)
        var handshakeKey: ByteArray? = null
        var nonce = 0
        fun mixHash(bytes: ByteArray) { hash = sha256(hash + bytes) }
        fun mixKey(dh: ByteArray) {
            val result = hkdf(chainingKey, dh)
            chainingKey = result[0]
            handshakeKey = result[1]
            nonce = 0
        }
        fun encryptAndHash(plain: ByteArray): ByteArray {
            val encrypted = handshakeKey?.let { chachaEncrypt(it, noiseNonce(nonce++), hash, plain) } ?: plain
            mixHash(encrypted)
            return encrypted
        }
        fun decryptAndHash(cipher: ByteArray): ByteArray {
            val plain = handshakeKey?.let { chachaDecrypt(it, noiseNonce(nonce++), hash, cipher) } ?: cipher
            mixHash(cipher)
            return plain
        }

        val localStatic = X25519PrivateKeyParameters(randomBytes(32), 0)
        val localEphemeral = X25519PrivateKeyParameters(randomBytes(32), 0)
        val localEphemeralPublic = localEphemeral.generatePublicKey().encoded
        mixHash(localEphemeralPublic)
        encryptAndHash(ByteArray(0))
        framed.write(localEphemeralPublic)

        val messageB = framed.read()
        if (messageB.size < 32 + 48) throw PairingProtocolException()
        val remoteEphemeralPublic = messageB.copyOfRange(0, 32)
        mixHash(remoteEphemeralPublic)
        mixKey(dh(localEphemeral, remoteEphemeralPublic))
        val remoteStaticCipher = messageB.copyOfRange(32, 80)
        val remoteStaticPublic = decryptAndHash(remoteStaticCipher)
        if (remoteStaticPublic.size != 32) throw PairingProtocolException()
        mixKey(dh(localEphemeral, remoteStaticPublic))
        val remotePayload = decryptAndHash(messageB.copyOfRange(80, messageB.size))
        verifyHandshakePayload(remotePayload, remoteStaticPublic, expectedRemoteIdentity)

        val localStaticPublic = localStatic.generatePublicKey().encoded
        val encryptedStatic = encryptAndHash(localStaticPublic)
        mixKey(dh(localStatic, remoteEphemeralPublic))
        val payload = encodeHandshakePayload(identity, localStaticPublic)
        val encryptedPayload = encryptAndHash(payload)
        framed.write(encryptedStatic + encryptedPayload)

        val split = hkdf(chainingKey, ByteArray(0))
        return SecureNoiseChannel(framed, NoiseCipher(split[0]), NoiseCipher(split[1]))
    }
}

private class FramedSocket(private val socket: RemoteSocket) {
    private var pending = ByteArray(0)

    suspend fun read(): ByteArray {
        while (pending.size < 2 || pending.size < 2 + unsignedShort(pending, 0)) {
            pending += socket.read()
        }
        val length = unsignedShort(pending, 0)
        val frame = pending.copyOfRange(2, 2 + length)
        pending = pending.copyOfRange(2 + length, pending.size)
        return frame
    }

    suspend fun write(value: ByteArray) {
        require(value.size <= 65_535)
        socket.write(byteArrayOf((value.size ushr 8).toByte(), value.size.toByte()) + value)
    }

    private fun unsignedShort(value: ByteArray, offset: Int): Int = ((value[offset].toInt() and 0xff) shl 8) or (value[offset + 1].toInt() and 0xff)
}

private class VarintFramedSocket(private val socket: RemoteSocket) {
    private var pending = ByteArray(0)

    suspend fun read(): ByteArray {
        while (true) {
            val parsed = readVarintFrame(pending)
            if (parsed != null) {
                pending = parsed.second
                return parsed.first
            }
            pending += socket.read()
        }
    }

    suspend fun write(value: ByteArray) {
        socket.write(encodeVarint(value.size) + value)
    }
}

private class RemoteSocket private constructor(private val webSocket: WebSocket, private val frames: Channel<ByteArray>) {
    companion object {
        suspend fun open(client: OkHttpClient, url: String): RemoteSocket = suspendCancellableCoroutine { continuation ->
            lateinit var socket: RemoteSocket
            val frames = Channel<ByteArray>(Channel.UNLIMITED)
            val listener = object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    socket = RemoteSocket(webSocket, frames)
                    if (continuation.isActive) continuation.resume(socket)
                }

                override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                    frames.trySend(bytes.toByteArray())
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    frames.close(t)
                    if (continuation.isActive) continuation.resumeWithException(t)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    frames.close()
                }
            }
            val request = Request.Builder().url(url).build()
            val created = client.newWebSocket(request, listener)
            continuation.invokeOnCancellation { created.cancel(); frames.close() }
        }
    }

    suspend fun read(): ByteArray = withTimeout(8_000) { frames.receive() }

    fun write(value: ByteArray) {
        if (!webSocket.send(ByteString.of(*value))) throw PairingProtocolException()
    }

    fun close() {
        webSocket.close(1000, null)
        webSocket.cancel()
    }
}

private class NoiseCipher(private val key: ByteArray) {
    private var nonce = 0

    fun encrypt(value: ByteArray): ByteArray = chachaEncrypt(key, noiseNonce(nonce++), ByteArray(0), value)

    fun decrypt(value: ByteArray): ByteArray = chachaDecrypt(key, noiseNonce(nonce++), ByteArray(0), value)
}

private fun encodeHandshakePayload(identity: PairingIdentity, staticPublicKey: ByteArray): ByteArray {
    val identityKey = identity.identityPublicKeyProtobuf()
    val signature = identity.sign("noise-libp2p-static-key:".toByteArray(StandardCharsets.UTF_8) + staticPublicKey)
    return byteArrayOf(0x0a, identityKey.size.toByte()) + identityKey + byteArrayOf(0x12, signature.size.toByte()) + signature + byteArrayOf(0x22, 0x00)
}

private fun verifyHandshakePayload(payload: ByteArray, staticPublicKey: ByteArray, expectedPeerId: String) {
    val fields = decodeProtoFields(payload)
    val identityKey = fields[1] ?: throw PairingProtocolException()
    val signature = fields[2] ?: throw PairingProtocolException()
    if (identityKey.size != 36 || identityKey[0] != 0x08.toByte() || identityKey[1] != 0x01.toByte() || identityKey[2] != 0x12.toByte() || identityKey[3] != 0x20.toByte()) throw PairingProtocolException()
    val publicKey = identityKey.copyOfRange(4, 36)
    val peerId = base58ForPublicKey(publicKey)
    if (peerId != expectedPeerId) throw PairingProtocolException()
    val signedBytes = "noise-libp2p-static-key:".toByteArray(StandardCharsets.UTF_8) + staticPublicKey
    if (!org.bouncycastle.crypto.signers.Ed25519Signer().run {
            init(false, org.bouncycastle.crypto.params.Ed25519PublicKeyParameters(publicKey, 0))
            update(signedBytes, 0, signedBytes.size)
            verifySignature(signature)
        }) throw PairingProtocolException()
}

private fun decodeProtoFields(bytes: ByteArray): Map<Int, ByteArray> {
    val values = mutableMapOf<Int, ByteArray>()
    var offset = 0
    while (offset < bytes.size) {
        val (tag, tagBytes) = readVarint(bytes, offset)
        offset += tagBytes
        val field = (tag ushr 3).toInt()
        if ((tag and 7) != 2L) throw PairingProtocolException()
        val (length, lengthBytes) = readVarint(bytes, offset)
        offset += lengthBytes
        val end = offset + length.toInt()
        if (end > bytes.size) throw PairingProtocolException()
        values[field] = bytes.copyOfRange(offset, end)
        offset = end
    }
    return values
}

private fun readVarint(bytes: ByteArray, start: Int): Pair<Long, Int> {
    var value = 0L
    var shift = 0
    var offset = start
    while (offset < bytes.size && shift < 64) {
        val next = bytes[offset++].toInt() and 0xff
        value = value or ((next and 0x7f).toLong() shl shift)
        if (next and 0x80 == 0) return value to (offset - start)
        shift += 7
    }
    throw PairingProtocolException()
}

private fun encodeVarint(value: Int): ByteArray {
    var remaining = value
    val output = java.io.ByteArrayOutputStream()
    do {
        var next = remaining and 0x7f
        remaining = remaining ushr 7
        if (remaining != 0) next = next or 0x80
        output.write(next)
    } while (remaining != 0)
    return output.toByteArray()
}

private fun readVarintFrame(bytes: ByteArray): Pair<ByteArray, ByteArray>? {
    if (bytes.isEmpty()) return null
    var length = 0L
    var shift = 0
    var offset = 0
    while (offset < bytes.size && shift < 64) {
        val next = bytes[offset++].toInt() and 0xff
        length = length or ((next and 0x7f).toLong() shl shift)
        if (next and 0x80 == 0) {
            val end = offset + length.toInt()
            if (end > bytes.size) return null
            return bytes.copyOfRange(offset, end) to bytes.copyOfRange(end, bytes.size)
        }
        shift += 7
    }
    if (shift >= 64) throw PairingProtocolException()
    return null
}

private fun base58ForPublicKey(publicKey: ByteArray): String {
    val key = byteArrayOf(0x08, 0x01, 0x12, 0x20) + publicKey
    val input = byteArrayOf(0x00, key.size.toByte()) + key
    val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    val digits = IntArray(input.size * 2)
    var size = 1
    input.forEach { byte ->
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
    val leadingZeroes = input.takeWhile { it == 0.toByte() }.count()
    return buildString(leadingZeroes + size) {
        repeat(leadingZeroes) { append(alphabet[0]) }
        for (index in size - 1 downTo 0) append(alphabet[digits[index]])
    }
}

private fun randomBytes(size: Int): ByteArray = ByteArray(size).also { java.security.SecureRandom().nextBytes(it) }

private fun dh(privateKey: X25519PrivateKeyParameters, remotePublic: ByteArray): ByteArray {
    val agreement = X25519Agreement()
    agreement.init(privateKey)
    return ByteArray(32).also { agreement.calculateAgreement(X25519PublicKeyParameters(remotePublic, 0), it, 0) }
}

private fun hkdf(salt: ByteArray, input: ByteArray): Array<ByteArray> {
    val prk = hmac(salt, input)
    val output = ByteArray(96)
    var previous = ByteArray(0)
    var offset = 0
    for (counter in 1..3) {
        previous = hmac(prk, previous + byteArrayOf(counter.toByte()))
        previous.copyInto(output, offset)
        offset += previous.size
    }
    return arrayOf(output.copyOfRange(0, 32), output.copyOfRange(32, 64), output.copyOfRange(64, 96))
}

private fun hmac(key: ByteArray, value: ByteArray): ByteArray = javax.crypto.Mac.getInstance("HmacSHA256").run {
    init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
    doFinal(value)
}

private fun sha256(value: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(value)

private fun noiseNonce(value: Int): ByteArray = ByteArray(12).also {
    it[4] = value.toByte()
    it[5] = (value ushr 8).toByte()
    it[6] = (value ushr 16).toByte()
    it[7] = (value ushr 24).toByte()
}

private fun chachaEncrypt(key: ByteArray, nonce: ByteArray, aad: ByteArray, plain: ByteArray): ByteArray {
    val cipher = ChaCha20Poly1305()
    cipher.init(true, AEADParameters(KeyParameter(key), 128, nonce, aad))
    return ByteArray(cipher.getOutputSize(plain.size)).also { output ->
        val offset = cipher.processBytes(plain, 0, plain.size, output, 0)
        cipher.doFinal(output, offset)
    }
}

private fun chachaDecrypt(key: ByteArray, nonce: ByteArray, aad: ByteArray, encrypted: ByteArray): ByteArray {
    val cipher = ChaCha20Poly1305()
    cipher.init(false, AEADParameters(KeyParameter(key), 128, nonce, aad))
    return ByteArray(cipher.getOutputSize(encrypted.size)).also { plain ->
        val offset = cipher.processBytes(encrypted, 0, encrypted.size, plain, 0)
        cipher.doFinal(plain, offset)
    }
}

private fun sha256Hex(value: ByteArray): String = sha256(value).joinToString("") { "%02x".format(it) }
