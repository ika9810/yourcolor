package com.robotics.yourcolor.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.widget.ImageView

/** Explicit clipping also works in the software renderer used by our layout proofs. */
class RoundedImageView(context: Context) : ImageView(context) {
    private val clip = Path()
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val radius = 22 * resources.displayMetrics.density
        clip.reset(); clip.addRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), radius, radius, Path.Direction.CW)
    }
    override fun onDraw(canvas: Canvas) { canvas.save(); canvas.clipPath(clip); super.onDraw(canvas); canvas.restore() }
}
