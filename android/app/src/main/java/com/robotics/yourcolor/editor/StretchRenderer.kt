package com.robotics.yourcolor.editor

import android.graphics.*
import kotlin.math.*

/** A masked scanline of actual photo pixels, extruded toward the chosen canvas edge. */
class StretchRenderer(private val maxMaskWidth: Int = 320) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var lastPhoto: Bitmap? = null
    private var lastMask: Bitmap? = null
    private var lastStrokes: List<MaskStroke>? = null
    private var mask: Bitmap? = null
    private var cutout: Bitmap? = null
    private var strip: Bitmap? = null
    private var stripKey: List<Any>? = null
    private var stripStart = 0f
    private var stripEnd = 0f
    private var maskPixels = IntArray(0)
    data class StripBounds(val start: Float, val end: Float, val center: Float)

    fun stripBounds(photo: Bitmap, foreground: Bitmap?, params: EditParams): StripBounds? {
        prepare(photo, foreground, params)
        prepareStrip(photo, params)
        if (strip == null) return null
        val cross = if (params.direction.dy != 0f) photo.width else photo.height
        return StripBounds(stripStart / cross, stripEnd / cross, (stripStart + stripEnd) / (2f * cross))
    }

    fun composedMask(photo: Bitmap, foreground: Bitmap?, params: EditParams): Bitmap {
        prepare(photo, foreground, params)
        return mask!!
    }
    private fun prepare(photo: Bitmap, foreground: Bitmap?, params: EditParams) {
        if (lastPhoto === photo && lastMask === foreground && lastStrokes == params.strokes) return
        lastPhoto = photo; lastMask = foreground; lastStrokes = params.strokes; stripKey = null
        val w = minOf(maxMaskWidth, photo.width); val h = (photo.height * w.toFloat() / photo.width).roundToInt()
        val result = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(result)
        foreground?.let { c.drawBitmap(it, null, Rect(0, 0, w, h), paint) }
        val brush = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
        for (stroke in params.strokes) {
            brush.strokeWidth = stroke.size * w
            brush.xfermode = if (stroke.erase) PorterDuffXfermode(PorterDuff.Mode.CLEAR) else null
            val first = stroke.points.firstOrNull() ?: continue
            brush.style = Paint.Style.FILL
            c.drawCircle(first.x * w, first.y * h, brush.strokeWidth / 2, brush)
            if (stroke.points.size > 1) {
                val path = Path().apply { moveTo(first.x * w, first.y * h); stroke.points.drop(1).forEach { lineTo(it.x * w, it.y * h) } }
                brush.style = Paint.Style.STROKE; c.drawPath(path, brush)
            }
        }
        mask = result
        maskPixels = IntArray(w * h); result.getPixels(maskPixels, 0, w, 0, 0, w, h)
        cutout = Bitmap.createBitmap(photo.width, photo.height, Bitmap.Config.ARGB_8888).also {
            val target = Canvas(it); target.drawBitmap(photo, 0f, 0f, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
            target.drawBitmap(result, null, Rect(0, 0, photo.width, photo.height), paint); paint.xfermode = null
        }
    }
    private fun prepareStrip(photo: Bitmap, params: EditParams) {
        val key = listOf(params.direction, params.sourceX, params.sourceY)
        if (stripKey == key) return
        stripKey = key; strip = null
        val vertical = params.direction.dy != 0f
        val n = if (vertical) photo.width else photo.height
        val x = (params.sourceX * (photo.width - 1)).roundToInt().coerceIn(0, photo.width - 1)
        val y = (params.sourceY * (photo.height - 1)).roundToInt().coerceIn(0, photo.height - 1)
        val row = IntArray(n)
        if (vertical) photo.getPixels(row, 0, n, 0, y, n, 1)
        else photo.getPixels(row, 0, 1, x, 0, 1, n)
        var start = n; var end = -1
        for (i in 0 until n) {
            val mx = ((if (vertical) i else x) * mask!!.width / photo.width).coerceIn(0, mask!!.width - 1)
            val my = ((if (vertical) y else i) * mask!!.height / photo.height).coerceIn(0, mask!!.height - 1)
            val alpha = maskPixels[my * mask!!.width + mx] ushr 24
            if (alpha > 96) { start = min(start, i); end = max(end, i) }
            val a = ((alpha - 64) / 128f * 255).roundToInt().coerceIn(0, 255)
            row[i] = (row[i] and 0xffffff) or (a shl 24)
        }
        if (end <= start) return
        stripStart = start.toFloat(); stripEnd = (end + 1).toFloat()
        val width = end - start + 1
        // Two identical rows are a texture for a smooth mesh; no invented gradient colors.
        val colors = IntArray(width * 2) { row[start + it % width] }
        strip = Bitmap.createBitmap(colors, width, 2, Bitmap.Config.ARGB_8888)
    }
    fun draw(canvas: Canvas, photo: Bitmap, foreground: Bitmap?, params: EditParams, width: Float, height: Float, original: Boolean = false) {
        canvas.save(); canvas.clipRect(0f, 0f, width, height)
        canvas.scale(width / photo.width, height / photo.height)
        if (original || (params.shape == Shape.NONE && params.background == Backdrop.PHOTO) || (foreground == null && params.strokes.isEmpty())) { canvas.drawBitmap(photo, 0f, 0f, paint); canvas.restore(); return }
        prepare(photo, foreground, params)
        if (params.background == Backdrop.PHOTO || (foreground == null && params.strokes.isEmpty())) canvas.drawBitmap(photo, 0f, 0f, paint)
        else {
            val ink = params.background == Backdrop.INK
            canvas.drawColor(if (ink) Color.rgb(16,22,19) else Color.rgb(231,226,213))
            val backdrop = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(photo.width*.47f,photo.height*.43f,photo.width*.76f,
                    if(ink) intArrayOf(0xff35493a.toInt(),0xff101613.toInt()) else intArrayOf(0xfffcf8ec.toInt(),0xffddd6c6.toInt()),null,Shader.TileMode.CLAMP)
            }
            canvas.drawRect(0f,0f,photo.width.toFloat(),photo.height.toFloat(),backdrop)
            if (!params.useSubject) cutout?.let { canvas.drawBitmap(it,0f,0f,paint) }
        }
        if (params.shape != Shape.NONE && params.length > 0f) {
            prepareStrip(photo, params)
            strip?.let { texture ->
                val w = photo.width.toFloat(); val h = photo.height.toFloat()
                val depth = when (params.direction) { Direction.UP -> params.sourceY * h; Direction.DOWN -> (1 - params.sourceY) * h; Direction.LEFT -> params.sourceX * w; Direction.RIGHT -> (1 - params.sourceX) * w }
                val cross = if (params.direction.dy != 0f) w else h
                val mid = (stripStart + stripEnd) / 2f; val size = stripEnd - stripStart
                val length = depth * params.length
                val transform = Matrix()
                when (params.direction) {
                    Direction.UP -> Unit
                    Direction.DOWN -> transform.setValues(floatArrayOf(1f,0f,0f,0f,-1f,h,0f,0f,1f))
                    Direction.LEFT -> transform.setValues(floatArrayOf(0f,1f,0f,1f,0f,0f,0f,0f,1f))
                    Direction.RIGHT -> transform.setValues(floatArrayOf(0f,-1f,w,1f,0f,0f,0f,0f,1f))
                }
                canvas.save(); canvas.concat(transform)
                val source = Rect(0,0,texture.width,1)
                val smoothPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isFilterBitmap = false }
                if (params.shape == Shape.STRAIGHT) {
                    canvas.drawBitmap(texture,source,RectF(stripStart,depth-length,stripEnd,depth+1f),smoothPaint)
                } else {
                    val rows = ceil(length).toInt().coerceAtLeast(1)
                    for (j in 0 until rows) {
                        val t = j / rows.toFloat(); val smooth = t * t * (3 - 2 * t)
                        val span = size * when (params.shape) { Shape.FAN -> 1 + params.amount * 1.6f * smooth; Shape.CURVE -> 1 + params.amount * 1.05f * t; else -> 1f }
                        val shift = if (params.shape == Shape.CURVE) sin(t * PI.toFloat() * .7f) * cross * .24f * params.amount else 0f
                        val v = depth - length * t
                        canvas.drawBitmap(texture,source,RectF(mid+shift-span/2f,v-length/rows,mid+shift+span/2f,v+1f),smoothPaint)
                    }
                }
                canvas.restore()
            }
        }
        if (params.useSubject) cutout?.let { canvas.drawBitmap(it, 0f, 0f, paint) }
        canvas.restore()
    }
    fun clear() { lastPhoto = null; lastMask = null; lastStrokes = null; mask = null; cutout = null; strip = null; stripKey = null; maskPixels = IntArray(0) }
    fun export(photo: Bitmap, foreground: Bitmap?, params: EditParams): Bitmap =
        Bitmap.createBitmap(photo.width, photo.height, Bitmap.Config.ARGB_8888).also { draw(Canvas(it), photo, foreground, params, it.width.toFloat(), it.height.toFloat()) }
}
