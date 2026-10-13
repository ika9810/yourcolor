package com.robotics.yourcolor

import android.graphics.*
import android.net.Uri
import android.os.Build
import android.view.View
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.robotics.yourcolor.data.*
import com.robotics.yourcolor.editor.*
import com.robotics.yourcolor.ui.PhotoCanvas
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class EditorIntegrationTest {
    private val context get()=ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun gradient(w:Int=160,h:Int=200)=Bitmap.createBitmap(IntArray(w*h){i->Color.rgb(i%w*255/w,i/w*255/h,80)},w,h,Bitmap.Config.ARGB_8888)
    private fun fixture()=File(context.cacheDir,"fixture.png").also {f->f.outputStream().use{gradient(640,800).compress(Bitmap.CompressFormat.PNG,100,it)}}
    private fun model(s:ActivityScenario<MainActivity>, action:(EditorViewModel)->Unit){s.onActivity{action(ViewModelProvider(it)[EditorViewModel::class.java])}}
    private fun await(s:ActivityScenario<MainActivity>,condition:(EditorViewModel)->Boolean){
        val until=System.currentTimeMillis()+60_000
        while(System.currentTimeMillis()<until){var ready=false;model(s){ready=condition(it)};if(ready){androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().waitForIdleSync();return};Thread.sleep(100)}
        fail("Timed out waiting for app state")
    }
    @Test fun maskedPixelsReachAllFourEdgesAndSubjectIsRestored() {
        val source=gradient();val mask=Bitmap.createBitmap(160,200,Bitmap.Config.ARGB_8888)
        Canvas(mask).drawRect(40f,50f,120f,150f,Paint().apply{color=Color.WHITE})
        val renderer=StretchRenderer()
        for(d in Direction.entries){
            val p=EditParams(shape=Shape.STRAIGHT,direction=d,length=1f,sourceX=.5f,sourceY=.5f)
            val out=renderer.export(source,mask,p)
            val x=when(d){Direction.LEFT->0;Direction.RIGHT->159;else->80}
            val y=when(d){Direction.UP->0;Direction.DOWN->199;else->100}
            val expected=source.getPixel(80,100);val actual=out.getPixel(x,y)
            assertTrue("$d red",abs(Color.red(expected)-Color.red(actual))<4)
            assertTrue("$d green",abs(Color.green(expected)-Color.green(actual))<4)
            assertEquals("subject stays intact",source.getPixel(80,120),out.getPixel(80,120))
            assertEquals("outside scanline remains original",source.getPixel(5,5),out.getPixel(5,5))
        }
    }
    @Test fun noEffectIsIdentityAndMaskPaintingAddsAndErases() {
        val source=gradient();val renderer=StretchRenderer()
        assertTrue(source.sameAs(renderer.export(source,null,EditParams())))
        val add=MaskStroke(listOf(BrushPoint(.5f,.5f)),.4f,false)
        val erase=MaskStroke(listOf(BrushPoint(.5f,.5f)),.1f,true)
        val mask=renderer.composedMask(source,null,EditParams(strokes=listOf(add,erase)))
        assertEquals(0,Color.alpha(mask.getPixel(80,100)));assertEquals(255,Color.alpha(mask.getPixel(100,100)))
    }
    @Test fun exifOrientationPrecedesTheSameCoverCropForPreviewAndExport() {
        val f=File(context.cacheDir,"orientation.jpg");f.outputStream().use{gradient(80,40).compress(Bitmap.CompressFormat.JPEG,100,it)}
        ExifInterface(f).apply{setAttribute(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_ROTATE_90.toString());saveAttributes()}
        val oriented=PhotoFiles.decode(context,f,2048);assertEquals(40,oriented.width);assertEquals(80,oriented.height)
        val crop=PhotoFiles.crop45(oriented);assertEquals(40,crop.width);assertEquals(50,crop.height);f.delete()
    }
    @Test fun manualPhotoExportWritesRealJpegAndKeepsFrozenParams() {
        ActivityScenario.launch(MainActivity::class.java).use{s->
            val f=fixture();model(s){it.load(Uri.fromFile(f))};await(s){it.screen==Screen.EDIT}
            model(s){assertEquals(Shape.NONE,it.session.params.shape);it.update(it.session.params.copy(length=.33f));it.beginExport()}
            await(s){it.screen==Screen.EXPORT}
            model(s){vm->vm.prepareExport{file->
                if(Build.VERSION.SDK_INT>=29)vm.save(file)
                else {val output=File(context.cacheDir,"exports/test-output.jpg").apply{parentFile!!.mkdirs();createNewFile()};vm.save(file,FileProvider.getUriForFile(context,"${context.packageName}.files",output))}
            }}
            await(s){it.savedUri!=null}
            model(s){vm->
                assertEquals(.33f,vm.snapshot!!.params.length)
                context.contentResolver.openInputStream(vm.savedUri!!)!!.use{val result=BitmapFactory.decodeStream(it)
                    val lowMemory=(context.getSystemService(android.content.Context.ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass<96
                    assertEquals(if(lowMemory)960 else 1440,result.width)
                    assertEquals(if(lowMemory)1200 else 1800,result.height)
                }
                context.contentResolver.delete(vm.savedUri!!,null,null)
            };f.delete()
        }
    }
    @Test fun saveRequestSurvivesActivityRecreation() {
        assumeTrue(Build.VERSION.SDK_INT >= 29)
        ActivityScenario.launch(MainActivity::class.java).use{s->
            val source=fixture()
            model(s){it.load(Uri.fromFile(source))};await(s){it.screen==Screen.EDIT}
            model(s){it.beginExport();it.requestExport()}
            s.recreate()
            await(s){it.savedUri!=null}
            model(s){vm->
                assertEquals(context.getString(R.string.saved_to_gallery),vm.exportMessage)
                context.contentResolver.delete(vm.savedUri!!,null,null)
            }
            source.delete()
        }
    }
    @Test fun maskCancelIsTransactionalAndRotationKeepsDraftThenUndo() {
        ActivityScenario.launch(MainActivity::class.java).use{s->
            val f=fixture();model(s){it.load(Uri.fromFile(f))};await(s){it.screen==Screen.EDIT}
            val stroke=MaskStroke(listOf(BrushPoint(.2f,.2f)),.1f,false)
            model(s){it.openMask();it.stroke(stroke);it.closeMask(false);assertTrue(it.session.params.strokes.isEmpty());it.openMask();it.stroke(stroke)}
            s.recreate();model(s){assertEquals(Screen.MASK,it.screen);assertEquals(listOf(stroke),it.maskDraft);it.closeMask(true);assertEquals(listOf(stroke),it.session.params.strokes);it.undo();assertTrue(it.session.params.strokes.isEmpty())};f.delete()
        }
    }
    @Test fun bundledModelSeparatesEverySampleWithoutNetworkPermission()=runBlocking {
        val requested=context.packageManager.getPackageInfo(context.packageName,android.content.pm.PackageManager.GET_PERMISSIONS).requestedPermissions.orEmpty()
        assertFalse(requested.contains("android.permission.INTERNET"))
        val service=SubjectService(context)
        try {for(name in listOf("midnight-coupe","chrome-muse","electric-bloom")){
            val source=context.assets.open("samples/$name.png").use{PhotoFiles.crop45(BitmapFactory.decodeStream(it))}
            val start=System.nanoTime();val result=service.analyze(source);assertNotNull(name,result)
            android.util.Log.i("YourColorTest","$name inferenceMs=${(System.nanoTime()-start)/1_000_000}")
            val pixels=IntArray(320*320);result!!.getPixels(pixels,0,320,0,0,320,320)
            assertTrue(name,pixels.count{Color.alpha(it)>127}>1000)
            val folder=File(context.getExternalFilesDir(null),"sample-cache").apply{mkdirs()}
            File(folder,"$name-mask.png").outputStream().use{result.compress(Bitmap.CompressFormat.PNG,100,it)}
            val params=when(name){"midnight-coupe"->EditParams(shape=Shape.STRAIGHT,length=1f,sourceY=.68f);"chrome-muse"->EditParams(shape=Shape.FAN,length=1f,sourceY=.51f,amount=.48f);else->EditParams(shape=Shape.CURVE,direction=Direction.DOWN,length=1f,sourceY=.35f,amount=.44f)}
            val small=Bitmap.createScaledBitmap(source,480,600,true)
            val rendered=StretchRenderer().export(small,result,params)
            File(folder,"$name-art.png").outputStream().use{rendered.compress(Bitmap.CompressFormat.PNG,100,it)}
            source.recycle()
        }}finally{service.close()}
    }
    @Test fun sampleFlowHasLargeFourByFiveArtworkAndAccessibleSave() {
        ActivityScenario.launch(MainActivity::class.java).use{s->
            s.onActivity{assertNotNull(it.findViewById<View>(R.id.start_photo))}
            model(s){it.loadSample("car")};await(s){it.screen==Screen.EDIT && it.analysis!=Analysis.PROCESSING}
            s.onActivity{a->
                val canvas=a.findViewById<PhotoCanvas>(R.id.effect_preview);assertNotNull(canvas)
                assertTrue("artwork aspect",abs(canvas.height.toFloat()/canvas.width-1.25f)<.01f)
                assertTrue("artwork must fill pane",canvas.width>250*a.resources.displayMetrics.density)
                val save=a.findViewById<View>(R.id.open_export);val visible=Rect();assertTrue(save.getGlobalVisibleRect(visible));assertTrue(visible.height()>0)
            }
            model(s){val p=it.session.params;assertEquals(1f,p.length);it.update(p.copy(direction=Direction.LEFT,shape=Shape.CURVE))}
            s.recreate();model(s){assertEquals(Direction.LEFT,it.session.params.direction);assertEquals(Shape.CURVE,it.session.params.shape)}
        }
    }
}
