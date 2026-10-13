package com.robotics.yourcolor

import android.graphics.Bitmap
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.robotics.yourcolor.editor.*
import com.robotics.yourcolor.ui.PhotoCanvas
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PhotoCanvasGestureTest {
    @Test fun dragIsOneUndoAndTwoFingerGestureNeverPaints() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario -> scenario.onActivity { a ->
            val edits=EditSession();edits.newPhoto(EditParams(shape=Shape.STRAIGHT))
            val strokes=mutableListOf<MaskStroke>()
            val canvas=PhotoCanvas(a).apply {
                photo=Bitmap.createBitmap(320,400,Bitmap.Config.ARGB_8888);params=edits.params;sourceMode=true
                onChange={edits.update(it);params=it};onGestureStart={edits.beginGesture()};onGestureEnd={edits.endGesture()};onStroke={strokes.add(it)}
            }
            FrameLayout(a).addView(canvas)
            canvas.measure(View.MeasureSpec.makeMeasureSpec(400,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(500,View.MeasureSpec.EXACTLY));canvas.layout(0,0,400,500)
            val time=SystemClock.uptimeMillis()
            fun touch(action:Int,x:Float,y:Float) {MotionEvent.obtain(time,SystemClock.uptimeMillis(),action,x,y,0).let{canvas.onTouchEvent(it);it.recycle()}}
            touch(MotionEvent.ACTION_DOWN,200f,275f);touch(MotionEvent.ACTION_MOVE,280f,300f);touch(MotionEvent.ACTION_UP,280f,300f)
            assertEquals(.7f,edits.params.sourceX,.001f);assertEquals(.6f,edits.params.sourceY,.001f)
            edits.undo();assertEquals(.5f,edits.params.sourceX,.001f);assertFalse(edits.canUndo)
            canvas.maskMode=true
            touch(MotionEvent.ACTION_DOWN,100f,100f);touch(MotionEvent.ACTION_MOVE,150f,150f);touch(MotionEvent.ACTION_UP,150f,150f)
            assertEquals(1,strokes.size);assertTrue(strokes.first().points.size>=2)
            touch(MotionEvent.ACTION_DOWN,100f,100f)
            val props=Array(2){i->MotionEvent.PointerProperties().apply{id=i;toolType=MotionEvent.TOOL_TYPE_FINGER}}
            val coords=Array(2){i->MotionEvent.PointerCoords().apply{x=100f+i*100;y=100f+i*100;pressure=1f;size=1f}}
            MotionEvent.obtain(time,SystemClock.uptimeMillis(),MotionEvent.ACTION_POINTER_DOWN or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT),2,props,coords,0,0,1f,1f,0,0,0,0).let{canvas.onTouchEvent(it);it.recycle()}
            touch(MotionEvent.ACTION_UP,150f,150f)
            assertEquals("Pinch must discard the provisional paint stroke",1,strokes.size)
        } }
    }
}
