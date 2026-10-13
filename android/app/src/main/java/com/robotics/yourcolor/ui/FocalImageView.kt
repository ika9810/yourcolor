package com.robotics.yourcolor.ui

import android.content.Context
import android.graphics.Matrix
import android.graphics.drawable.Drawable
import android.widget.ImageView
import kotlin.math.max

/** CENTER_CROP with the vertical focal position used by the approved sample tiles. */
class FocalImageView(context: Context, private val focalY: Float) : ImageView(context) {
    init { scaleType = ScaleType.MATRIX }

    override fun setImageDrawable(drawable: Drawable?) {
        super.setImageDrawable(drawable)
        updateCrop()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        updateCrop()
    }

    private fun updateCrop() {
        val d = drawable ?: return
        if (width <= 0 || height <= 0 || d.intrinsicWidth <= 0 || d.intrinsicHeight <= 0) return
        val scale = max(width.toFloat()/d.intrinsicWidth,height.toFloat()/d.intrinsicHeight)
        val matrix = Matrix()
        matrix.setScale(scale,scale)
        matrix.postTranslate((width-d.intrinsicWidth*scale)/2f,(height-d.intrinsicHeight*scale)*focalY)
        imageMatrix = matrix
    }
}
