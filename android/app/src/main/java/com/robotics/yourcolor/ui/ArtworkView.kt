package com.robotics.yourcolor.ui

import android.content.Context
import android.graphics.*
import android.view.View

/** The approved wordmark: the middle column of the multicolored 'o' is stretched. */
class ArtworkView(context: Context) : View(context) {
    private val art: Bitmap
    init {
        contentDescription = "yourcolor"
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 142f; typeface = Typeface.createFromAsset(context.assets, "fonts/WantedSansExtraBold.ttf"); color = Color.rgb(35,35,43) }
        val prefix = "yourc"; val suffix = "lor"; val x = 8 + paint.measureText(prefix) + 4
        val letterWidth = paint.measureText("o"); val cut = (letterWidth / 2).toInt(); val stretch = 64
        val after = x + letterWidth + stretch + 1
        art = Bitmap.createBitmap((after + paint.measureText(suffix) + 10).toInt(), 160, Bitmap.Config.ARGB_8888)
        val c = Canvas(art); c.translate(0f, -10f); c.drawText(prefix, 8f, 140f, paint)
        val glyph = Bitmap.createBitmap(110, 180, Bitmap.Config.ARGB_8888)
        val g = Canvas(glyph); g.drawText("o", 0f, 140f, paint)
        val colors = intArrayOf(0xff6631b5.toInt(),0xffe6a0ba.toInt(),0xff803994.toInt(),0xffef6d40.toInt(),0xffe49b4a.toInt(),0xff37243f.toInt(),0xffe86030.toInt(),0xfff6b273.toInt(),0xff70356d.toInt(),0xffef502f.toInt(),0xffec9873.toInt(),0xffb22f67.toInt(),0xff65339a.toInt())
        paint.shader = LinearGradient(0f,57f,0f,141f,colors,floatArrayOf(0f,.06f,.12f,.18f,.25f,.34f,.52f,.65f,.76f,.82f,.88f,.94f,1f),Shader.TileMode.CLAMP)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN); g.drawRect(0f,0f,110f,180f,paint)
        paint.shader = null; paint.xfermode = null
        c.drawBitmap(glyph,Rect(0,0,cut,180),RectF(x,0f,x+cut,180f),paint)
        c.drawBitmap(glyph,Rect(cut,0,cut+1,180),RectF(x+cut,0f,x+cut+stretch,180f),paint)
        c.drawBitmap(glyph,Rect(cut,0,110,180),RectF(x+cut+stretch,0f,x+110+stretch,180f),paint)
        c.drawText(suffix,after,140f,paint); glyph.recycle()
    }
    override fun onDraw(canvas: Canvas) { canvas.drawBitmap(art, null, RectF(0f,0f,width.toFloat(),height.toFloat()), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)) }
}
