package com.robotics.yourcolor.data

import android.content.ContentValues
import android.content.Context
import android.graphics.*
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import com.robotics.yourcolor.R
import com.robotics.yourcolor.editor.EditParams
import com.robotics.yourcolor.editor.StretchRenderer
import java.io.File
import java.io.IOException
import kotlin.math.max
import kotlin.math.roundToInt

data class Photo(val file: File, val preview: Bitmap)
data class ExportSnapshot(val file: File, val params: EditParams, val foreground: Bitmap?)

object PhotoFiles {
    private fun memoryClass(context: Context) = (context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass
    fun exportDescription(context: Context) = if (memoryClass(context) < 96) context.getString(R.string.export_quality_low) else context.getString(R.string.export_quality_high)
    fun import(context: Context, uri: Uri): Photo {
        val folder = File(context.cacheDir, "photos").apply { mkdirs() }
        val file = File.createTempFile("photo-", ".source", folder)
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                file.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024); var total = 0L
                    while (true) {
                        val count = input.read(buffer); if (count < 0) break
                        total += count
                        if (total > 100L * 1024 * 1024) throw IOException(context.getString(R.string.photo_limit))
                        output.write(buffer, 0, count)
                    }
                }
            } ?: throw IOException(context.getString(R.string.photo_unavailable))
            return Photo(file, crop45(decode(context, file, if (memoryClass(context) < 96) 640 else 960)))
        } catch (e: Exception) { file.delete(); throw e }
    }

    fun decode(context: Context, file: File, maxSide: Int): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IOException(context.getString(R.string.photo_format_unsupported))
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > maxSide * 2) sample *= 2
        val options = BitmapFactory.Options().apply {
            inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888
            if (Build.VERSION.SDK_INT >= 26) inPreferredColorSpace = ColorSpace.get(ColorSpace.Named.SRGB)
        }
        val decoded = BitmapFactory.decodeFile(file.path, options) ?: throw IOException(context.getString(R.string.photo_decode_failed))
        val matrix = Matrix()
        val exif = ExifInterface(file)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.setRotate(-90f); matrix.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
        }
        val oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
        if (oriented !== decoded) decoded.recycle()
        val factor = (maxSide.toFloat() / max(oriented.width, oriented.height)).coerceAtMost(1f)
        if (factor == 1f) return oriented
        val scaled = Bitmap.createScaledBitmap(oriented, (oriented.width * factor).roundToInt().coerceAtLeast(1), (oriented.height * factor).roundToInt().coerceAtLeast(1), true)
        if (scaled !== oriented) oriented.recycle()
        return scaled
    }

    fun crop45(source: Bitmap): Bitmap {
        val width = minOf(source.width, (source.height * .8f).roundToInt())
        val height = minOf(source.height, (width * 1.25f).roundToInt())
        val cropped = Bitmap.createBitmap(source, (source.width - width) / 2, (source.height - height) / 2, width, height)
        if (cropped !== source) source.recycle()
        return cropped
    }

    fun sample(context: Context, name: String): Photo {
        val folder = File(context.cacheDir, "photos").apply { mkdirs() }
        val file = File.createTempFile("sample-", ".png", folder)
        try {
            context.assets.open("samples/$name.png").use { input -> file.outputStream().use { input.copyTo(it) } }
            return Photo(file, crop45(decode(context, file, if (memoryClass(context) < 96) 640 else 960)))
        } catch (e: Exception) { file.delete(); throw e }
    }

    fun renderJpeg(context: Context, snapshot: ExportSnapshot): File {
        val lowMemory = memoryClass(context) < 96
        val cropped = crop45(decode(context, snapshot.file, if (lowMemory) 1200 else 1800))
        val targetWidth = if (lowMemory) 960 else 1440
        val targetHeight = if (lowMemory) 1200 else 1800
        val source = if (cropped.width == targetWidth && cropped.height == targetHeight) cropped
            else Bitmap.createScaledBitmap(cropped, targetWidth, targetHeight, true).also { cropped.recycle() }
        var result: Bitmap? = null
        val out = File(File(context.cacheDir, "exports").apply { mkdirs() }, "YourColor-${System.currentTimeMillis()}.jpg")
        try {
            result = StretchRenderer(if (lowMemory) 320 else 960).export(source, snapshot.foreground, snapshot.params)
            out.outputStream().use { if (!result.compress(Bitmap.CompressFormat.JPEG, 95, it)) throw IOException(context.getString(R.string.image_create_failed)) }
            return out
        } catch (e: Exception) { out.delete(); throw e }
        finally { result?.recycle(); source.recycle() }
    }

    fun saveToGallery(context: Context, file: File): Uri {
        check(Build.VERSION.SDK_INT >= 29)
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, file.name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/YourColor")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: throw IOException(context.getString(R.string.check_storage))
        try {
            resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } } ?: throw IOException(context.getString(R.string.save_location_unavailable))
            val updated = resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            if (updated < 1) throw IOException(context.getString(R.string.save_incomplete))
            return uri
        } catch (e: Exception) { resolver.delete(uri, null, null); throw e }
    }

    fun saveToDocument(context: Context, file: File, uri: Uri) {
        try {
            context.contentResolver.openOutputStream(uri, "w")?.use { out -> file.inputStream().use { it.copyTo(out) } }
                ?: throw IOException(context.getString(R.string.save_location_unavailable))
        } catch (e: Exception) {
            runCatching { android.provider.DocumentsContract.deleteDocument(context.contentResolver, uri) }
            throw e
        }
    }
}
