package com.robotics.yourcolor.ui

import com.robotics.yourcolor.R

import android.content.Context
import android.app.ActivityManager
import android.graphics.*
import android.os.Bundle
import android.view.*
import android.view.accessibility.AccessibilityNodeInfo
import com.robotics.yourcolor.editor.*
import kotlin.math.*

class PhotoCanvas(context: Context) : View(context) {
    var photo: Bitmap? = null
    var mask: Bitmap? = null
    var params = EditParams()
    var original = false
    var editable = true
    var maskMode = false
    var sourceMode = false
    var brushSize = .07f
    var erase = false
    var onChange: (EditParams) -> Unit = {}
    var onGestureStart: () -> Unit = {}
    var onGestureEnd: () -> Unit = {}
    var onStroke: (MaskStroke) -> Unit = {}
    private val renderer = StretchRenderer(if ((context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).memoryClass < 96) 320 else 960)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var zoom = 1f
    private var panX = 0f; private var panY = 0f
    private var previousX = 0f; private var previousY = 0f
    private var multi = false
    private var drag = 0
    private val points = mutableListOf<BrushPoint>()
    private val scale = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val old = zoom; zoom = (zoom * detector.scaleFactor).coerceIn(1f, 5f)
            panX = detector.focusX - (detector.focusX - panX) * zoom / old
            panY = detector.focusY - (detector.focusY - panY) * zoom / old
            constrain(); invalidate(); return true
        }
    })
    init { isFocusable = true; contentDescription = context.getString(R.string.canvas_description) }
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        setMeasuredDimension(w, resolveSize((w * 1.25f).roundToInt(), heightMeasureSpec))
    }
    private fun constrain() { panX = panX.coerceIn(width * (1 - zoom), 0f); panY = panY.coerceIn(height * (1 - zoom), 0f) }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val image = photo ?: return
        canvas.save()
        val clip = Path().apply { addRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), dp(22), dp(22), Path.Direction.CW) }
        canvas.clipPath(clip)
        if (maskMode) {
            canvas.translate(panX, panY); canvas.scale(zoom, zoom)
            paint.colorFilter = null; paint.alpha = 255
            canvas.drawBitmap(image, null, Rect(0, 0, width, height), paint)
            val composed = renderer.composedMask(image, mask, params)
            paint.colorFilter = PorterDuffColorFilter(Color.rgb(151, 90, 255), PorterDuff.Mode.SRC_IN); paint.alpha = 120
            canvas.drawBitmap(composed, null, Rect(0, 0, width, height), paint)
            paint.colorFilter = null; paint.alpha = 255
            if (points.isNotEmpty()) {
                paint.color = if (erase) 0x99ffffff.toInt() else 0x99975aff.toInt()
                paint.strokeWidth = brushSize * width; paint.strokeCap = Paint.Cap.ROUND; paint.strokeJoin = Paint.Join.ROUND
                paint.style = Paint.Style.STROKE
                val path = Path().apply { moveTo(points.first().x * width, points.first().y * height); points.drop(1).forEach { lineTo(it.x * width, it.y * height) } }
                canvas.drawPath(path, paint); paint.style = Paint.Style.FILL
                canvas.drawCircle(points.last().x * width, points.last().y * height, brushSize * width / 2, paint)
            }
        } else {
            renderer.draw(canvas, image, mask, params, width.toFloat(), height.toFloat(), original)
            if (editable && !original) drawGuide(canvas)
        }
        canvas.restore()
    }
    private fun tip(): PointF {
        val bounds = photo?.let { renderer.stripBounds(it, mask, params) }
        val x = if (params.direction.dy != 0f) (bounds?.center ?: params.sourceX) * width else params.sourceX * width
        val y = if (params.direction.dy == 0f) (bounds?.center ?: params.sourceY) * height else params.sourceY * height
        return when (params.direction) {
            Direction.UP -> PointF(x, y * (1 - params.length))
            Direction.DOWN -> PointF(x, y + (height - y) * params.length)
            Direction.LEFT -> PointF(x * (1 - params.length), y)
            Direction.RIGHT -> PointF(x + (width - x) * params.length, y)
        }.apply { this.x = this.x.coerceIn(dp(19), width - dp(19)); this.y = this.y.coerceIn(dp(19), height - dp(19)) }
    }
    private fun drawGuide(c: Canvas) {
        if (params.shape == Shape.NONE) return
        val bounds = photo?.let { renderer.stripBounds(it, mask, params) } ?: return
        val horizontal = params.direction.dy != 0f
        val x = if (horizontal) bounds.center * width else params.sourceX * width
        val y = if (horizontal) params.sourceY * height else bounds.center * height
        paint.color = 0xff202b21.toInt(); paint.style = Paint.Style.STROKE; paint.strokeWidth = dp(3)
        val x1 = if (horizontal) bounds.start * width else x; val y1 = if (horizontal) y else bounds.start * height
        val x2 = if (horizontal) bounds.end * width else x; val y2 = if (horizontal) y else bounds.end * height
        c.drawLine(x1, y1, x2, y2, paint)
        paint.color = 0xffe1fbc5.toInt(); paint.strokeWidth = dp(1); paint.pathEffect = DashPathEffect(floatArrayOf(dp(3), dp(2)), 0f)
        c.drawLine(x1, y1, x2, y2, paint); paint.pathEffect = null
        val tip = tip()
        paint.color = 0x88ffffff.toInt(); paint.strokeWidth = dp(1); paint.pathEffect = DashPathEffect(floatArrayOf(dp(2),dp(4)),0f)
        c.drawLine(x,y,tip.x,tip.y,paint); paint.pathEffect = null
        paint.style = Paint.Style.FILL; paint.color = 0xffdff5bf.toInt(); c.drawCircle(x, y, dp(6), paint)
        paint.color = 0xff223025.toInt(); paint.style = Paint.Style.STROKE; paint.strokeWidth=dp(1); c.drawCircle(x, y, dp(6), paint)
        run {
            paint.style = Paint.Style.FILL; paint.color = 0xfff2f6e7.toInt(); c.drawCircle(tip.x, tip.y, dp(13), paint)
            paint.color = 0xff223025.toInt(); paint.style = Paint.Style.STROKE; c.drawCircle(tip.x, tip.y, dp(13), paint)
            c.save(); c.translate(tip.x, tip.y)
            c.rotate(when (params.direction) { Direction.UP -> 0f; Direction.DOWN -> 180f; Direction.LEFT -> -90f; Direction.RIGHT -> 90f })
            paint.strokeWidth = dp(1.4f); paint.strokeCap = Paint.Cap.ROUND
            c.drawLine(0f, dp(5), 0f, -dp(5), paint); c.drawLine(-dp(4), -dp(1), 0f, -dp(5), paint); c.drawLine(dp(4), -dp(1), 0f, -dp(5), paint)
            c.restore()
        }
        paint.style = Paint.Style.FILL
    }
    private fun point(event: MotionEvent) = BrushPoint(((event.x - panX) / (width * zoom)).coerceIn(0f, 1f), ((event.y - panY) / (height * zoom)).coerceIn(0f, 1f))
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!editable || photo == null) return false
        if (maskMode) {
            scale.onTouchEvent(event)
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { multi = false; points.clear(); points.add(point(event)); parent.requestDisallowInterceptTouchEvent(true) }
                MotionEvent.ACTION_POINTER_DOWN -> { multi = true; points.clear(); previousX = (event.getX(0) + event.getX(1)) / 2; previousY = (event.getY(0) + event.getY(1)) / 2 }
                MotionEvent.ACTION_MOVE -> {
                    if (event.pointerCount >= 2) {
                        val x = (event.getX(0) + event.getX(1)) / 2; val y = (event.getY(0) + event.getY(1)) / 2
                        panX += x - previousX; panY += y - previousY; previousX = x; previousY = y; constrain()
                    } else if (!multi) points.add(point(event))
                }
                MotionEvent.ACTION_UP -> { if (!multi && points.isNotEmpty()) onStroke(MaskStroke(points.toList(), brushSize, erase)); points.clear(); parent.requestDisallowInterceptTouchEvent(false); performClick() }
                MotionEvent.ACTION_CANCEL -> { points.clear(); parent.requestDisallowInterceptTouchEvent(false) }
            }
            invalidate(); return true
        }
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val bounds = photo?.let { renderer.stripBounds(it, mask, params) }
                val sourceX = if (params.direction.dy != 0f) (bounds?.center ?: params.sourceX) * width else params.sourceX * width
                val sourceY = if (params.direction.dy == 0f) (bounds?.center ?: params.sourceY) * height else params.sourceY * height
                val dist = hypot(event.x - sourceX, event.y - sourceY)
                val tip = tip()
                drag = if (sourceMode || dist < dp(26)) 1 else if (params.shape != Shape.NONE && hypot(event.x - tip.x, event.y - tip.y) < dp(30)) 2 else 0
                if (drag == 0) return false
                parent.requestDisallowInterceptTouchEvent(true); onGestureStart(); move(event)
            }
            MotionEvent.ACTION_MOVE -> if (drag != 0) move(event)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { if (drag != 0) onGestureEnd(); drag = 0; parent.requestDisallowInterceptTouchEvent(false); performClick() }
        }
        return true
    }
    private fun move(event: MotionEvent) {
        val x = (event.x / width).coerceIn(0f, 1f); val y = (event.y / height).coerceIn(0f, 1f)
        if (drag == 1) onChange(params.copy(sourceX = x.coerceIn(.01f, .99f), sourceY = y.coerceIn(.01f, .99f)))
        else {
            val length = when (params.direction) { Direction.UP -> (params.sourceY - y) / params.sourceY; Direction.DOWN -> (y - params.sourceY) / (1 - params.sourceY); Direction.LEFT -> (params.sourceX - x) / params.sourceX; Direction.RIGHT -> (x - params.sourceX) / (1 - params.sourceX) }
            onChange(params.copy(length = length.coerceIn(0f, 1f)))
        }
    }
    override fun onDetachedFromWindow() { super.onDetachedFromWindow(); renderer.clear() }
    override fun performClick(): Boolean { super.performClick(); return true }
    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        if (editable && !maskMode) { info.className = "android.widget.SeekBar"; info.rangeInfo = AccessibilityNodeInfo.RangeInfo.obtain(AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_INT, 0f, 100f, params.length * 100); info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD); info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD) }
    }
    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
        if (editable && !maskMode && action in listOf(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD, AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)) {
            onChange(params.copy(shape = if (params.shape == Shape.NONE) Shape.STRAIGHT else params.shape, length = (params.length + if (action == AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) .05f else -.05f).coerceIn(0f, 1f))); return true
        }
        return super.performAccessibilityAction(action, arguments)
    }
    private fun dp(value: Int) = dp(value.toFloat())
    private fun dp(value: Float) = value * resources.displayMetrics.density
}
