package com.robotics.yourcolor.ui

import android.content.Context
import android.graphics.*
import android.view.View

class IconView(context: Context, private val icon: String, private val tint: Int = 0xff1c1c1e.toInt()) : View(context) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tint; style = Paint.Style.STROKE; strokeWidth = 1.7f; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    override fun onDraw(c: Canvas) {
        val size = 24 * resources.displayMetrics.density
        c.save(); c.translate((width - size)/2,(height - size)/2); c.scale(size/24,size/24)
        fun path(vararg xy: Float) { val a = Path(); a.moveTo(xy[0],xy[1]); for (i in 2 until xy.size step 2) a.lineTo(xy[i],xy[i+1]); c.drawPath(a,p) }
        when(icon) {
            "back" -> path(14f,4f,6f,12f,14f,20f)
            "close" -> { path(5f,5f,19f,19f); path(19f,5f,5f,19f) }
            "plus" -> { path(12f,4f,12f,20f); path(4f,12f,20f,12f) }
            "eye" -> { val a=Path(); a.moveTo(2f,12f); a.cubicTo(7f,2f,17f,2f,22f,12f); a.cubicTo(17f,22f,7f,22f,2f,12f); c.drawPath(a,p); c.drawCircle(12f,12f,3f,p) }
            "undo", "redo" -> { if(icon=="redo") {c.translate(24f,0f);c.scale(-1f,1f)}; path(8f,4f,3f,9f,8f,14f); val a=Path();a.moveTo(3f,9f);a.lineTo(13f,9f);a.cubicTo(23f,9f,23f,22f,12f,21f);c.drawPath(a,p) }
            "stretch" -> { path(12f,3f,12f,21f); path(7f,8f,12f,3f,17f,8f); path(7f,16f,12f,21f,17f,16f);path(3f,9f,3f,15f);path(21f,9f,21f,15f) }
            "shape" -> { for(d in 0..2){val a=Path(); a.moveTo(3f,20f-d*3);a.cubicTo(17f,20f-d*3,7f,4f-d*3,21f,4f-d*3);c.drawPath(a,p)} }
            "subject" -> { c.drawCircle(12f,8f,3f,p); c.drawArc(RectF(6f,12f,18f,24f),180f,180f,false,p);path(7f,2f,2f,2f,2f,7f);path(17f,2f,22f,2f,22f,7f);path(2f,17f,2f,22f,7f,22f);path(17f,22f,22f,22f,22f,17f) }
            "background" -> { c.drawRoundRect(RectF(3f,3f,21f,21f),4f,4f,p); path(4f,17f,17f,4f);path(8f,21f,21f,8f) }
            "up","down","left","right" -> { c.rotate(when(icon){"down"->180f;"left"->-90f;"right"->90f;else->0f},12f,12f);path(12f,20f,12f,4f);path(6f,10f,12f,4f,18f,10f) }
        }
        c.restore()
    }
}
