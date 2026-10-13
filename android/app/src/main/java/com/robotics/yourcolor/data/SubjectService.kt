package com.robotics.yourcolor.data

import android.content.Context
import android.graphics.Bitmap
import ai.onnxruntime.*
import java.nio.FloatBuffer
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.math.roundToInt

/** Bundled U²-NetP. No service, network permission, model download or paid endpoint. */
class SubjectService(private val context: Context) {
    private val lock = Mutex()
    private var session: OrtSession? = null
    suspend fun analyze(photo: Bitmap): Bitmap? = lock.withLock {
        val environment = OrtEnvironment.getEnvironment()
        val model = session ?: OrtSession.SessionOptions().use { options ->
            options.setIntraOpNumThreads(2)
            options.setInterOpNumThreads(1)
            environment.createSession(context.assets.open("models/u2netp.onnx").use { it.readBytes() }, options)
        }.also { session = it }
        val size = 320; val count = size * size
        val scaled = Bitmap.createScaledBitmap(photo, size, size, true)
        val pixels = IntArray(count); scaled.getPixels(pixels, 0, size, 0, 0, size, size)
        if (scaled !== photo) scaled.recycle()
        var max = 1f
        for (p in pixels) max = maxOf(max, ((p shr 16) and 255).toFloat(), ((p shr 8) and 255).toFloat(), (p and 255).toFloat())
        val input = FloatArray(count * 3)
        val means = floatArrayOf(.485f, .456f, .406f); val std = floatArrayOf(.229f, .224f, .225f)
        for (c in 0..2) for (i in pixels.indices) input[c * count + i] = (((pixels[i] shr (16 - 8 * c)) and 255) / max - means[c]) / std[c]
        OnnxTensor.createTensor(environment, FloatBuffer.wrap(input), longArrayOf(1, 3, 320, 320)).use { tensor ->
            model.run(mapOf(model.inputNames.first() to tensor)).use { result ->
                val output = (result[0] as OnnxTensor).floatBuffer
                val values = FloatArray(count); output.get(values)
                val low = values.minOrNull()!!; val high = values.maxOrNull()!!
                if (high - low < 1e-6f) return@withLock null
                var selected = 0
                for (i in values.indices) {
                    val t = (((values[i] - low) / (high - low) - .1f) / .8f).coerceIn(0f, 1f)
                    val alpha = (t * t * (3 - 2 * t) * 255).roundToInt()
                    if (alpha > 127) selected++
                    pixels[i] = (alpha shl 24) or 0x00ffffff
                }
                if (selected < count * .002f || selected > count * .98f) return@withLock null
                Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
            }
        }
    }
    suspend fun close() = lock.withLock { session?.close(); session = null }
}
