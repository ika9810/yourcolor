package com.robotics.yourcolor

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.view.View
import android.widget.ScrollView
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.robotics.yourcolor.editor.*
import com.robotics.yourcolor.ui.PhotoCanvas
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import kotlin.math.abs

/** Runs on a real Android window. Display profiles are configured by the host test script. */
@RunWith(AndroidJUnit4::class)
class DeviceLayoutTest {
    @Test fun fullFlowFitsCurrentWindowAndKeepsEditAcrossRecreation() {
        val label=InstrumentationRegistry.getArguments().getString("profile")?:"default"
        ActivityScenario.launch(MainActivity::class.java).use{s->
            await(s){it.sampleArt.size==3}
            if(label!="flip8-cover-layout-only") s.onActivity{a->
                val button=a.findViewById<View>(R.id.start_photo)
                val bounds=Rect()
                assertTrue("Home CTA visible",button.getGlobalVisibleRect(bounds))
                assertTrue("Home CTA fully visible",bounds.height()>=button.height-1)
            }
            capture(s,label,"home")
            s.onActivity{it.findViewById<View>(R.id.start_photo).performClick()}
            await(s){it.screen==Screen.PICK};capture(s,label,"picker")
            s.onActivity{ViewModelProvider(it)[EditorViewModel::class.java].loadSample("portrait")}
            await(s){it.screen==Screen.EDIT && it.analysis==Analysis.READY};capture(s,label,"editor")
            var oldScroll = 0
            fun scrolls(v:View):List<ScrollView> = (if(v is ScrollView)listOf(v) else emptyList()) + if(v is android.view.ViewGroup)(0 until v.childCount).flatMap{scrolls(v.getChildAt(it))} else emptyList()
            s.onActivity{a->val sc=scrolls(a.window.decorView).first();sc.scrollTo(0,100);oldScroll=sc.scrollY;val vm=ViewModelProvider(a)[EditorViewModel::class.java];vm.tool="shape";vm.notifyChange()}
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            s.onActivity{a->
                val sc=scrolls(a.window.decorView).first()
                val maxScroll=(sc.getChildAt(0).height-sc.height+sc.paddingTop+sc.paddingBottom).coerceAtLeast(0)
                assertEquals("Tool changes keep scroll position within the new content range",minOf(oldScroll,maxScroll),sc.scrollY)
            }
            s.onActivity{a->
                val c=a.findViewById<PhotoCanvas>(R.id.effect_preview)
                assertTrue("4:5 ratio",abs(c.height/c.width.toFloat()-1.25f)<.01f)
                val r=Rect();assertTrue(a.findViewById<View>(R.id.open_export).getGlobalVisibleRect(r))
                val vm=ViewModelProvider(a)[EditorViewModel::class.java];vm.update(vm.session.params.copy(direction=Direction.LEFT,length=.63f));vm.openMask()
                vm.stroke(MaskStroke(listOf(BrushPoint(.1f,.1f),BrushPoint(.2f,.2f)),.05f,false))
            }
            await(s){it.screen==Screen.MASK};capture(s,label,"mask")
            s.recreate()
            s.onActivity{a->val vm=ViewModelProvider(a)[EditorViewModel::class.java];assertEquals(.63f,vm.session.params.length);assertEquals(1,vm.maskDraft.size);vm.closeMask(false);assertTrue(vm.session.params.strokes.isEmpty());vm.beginExport()}
            await(s){it.screen==Screen.EXPORT};capture(s,label,"export")
            // A small display must allow scrolling all the way to the save button.
            s.onActivity{a->val button=a.findViewById<View>(R.id.save_image);button.requestRectangleOnScreen(Rect(0,0,button.width,button.height),true)}
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            s.onActivity{a->val button=a.findViewById<View>(R.id.save_image);val r=Rect();assertTrue("Save reachable",button.getGlobalVisibleRect(r));assertTrue(r.height()>=button.height-1)}
            capture(s,label,"export-save")
        }
    }
    private fun await(s:ActivityScenario<MainActivity>,condition:(EditorViewModel)->Boolean){
        val end=System.currentTimeMillis()+30_000
        while(System.currentTimeMillis()<end){var ready=false;s.onActivity{ready=condition(ViewModelProvider(it)[EditorViewModel::class.java])};if(ready){InstrumentationRegistry.getInstrumentation().waitForIdleSync();return};Thread.sleep(60)}
        fail("UI did not reach expected state")
    }
    private fun capture(s:ActivityScenario<MainActivity>,label:String,screen:String){
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        s.onActivity{a->
            val view=a.window.decorView
            assertTrue(view.width>0 && view.height>0)
            val scale=minOf(1f,1600f/maxOf(view.width,view.height))
            val bitmap=Bitmap.createBitmap((view.width*scale).toInt(),(view.height*scale).toInt(),Bitmap.Config.ARGB_8888)
            view.draw(Canvas(bitmap).apply{scale(scale,scale)})
            val folder=File(a.getExternalFilesDir(null),"device-proofs/$label").apply{mkdirs()}
            File(folder,"$screen.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()
            File(folder,"window.txt").writeText("${view.width}x${view.height} pixels; density=${a.resources.displayMetrics.density}; API=${android.os.Build.VERSION.SDK_INT}\n")
        }
    }
}
