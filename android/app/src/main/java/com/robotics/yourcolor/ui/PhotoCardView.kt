package com.robotics.yourcolor.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.view.ViewOutlineProvider
import android.widget.FrameLayout

/** Clips the artwork and its white frame together, including on the hardware canvas. */
class PhotoCardView(context: Context, radiusDp: Float = 28f, borderDp: Float = 3f) : FrameLayout(context) {
    private val density = resources.displayMetrics.density
    private val radius = radiusDp * density
    private val border = borderDp * density
    private val path = Path()
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = border * 2
    }

    init {
        setWillNotDraw(false)
        background = GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = radius }
        outlineProvider = ViewOutlineProvider.BACKGROUND
        elevation = 9f * density
    }

    override fun dispatchDraw(canvas: Canvas) {
        path.reset()
        path.addRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), radius, radius, Path.Direction.CW)
        val saved = canvas.save()
        canvas.clipPath(path)
        super.dispatchDraw(canvas)
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), radius, radius, stroke)
        canvas.restoreToCount(saved)
    }
}
