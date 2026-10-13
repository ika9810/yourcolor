package com.robotics.yourcolor

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.robotics.yourcolor.data.*
import com.robotics.yourcolor.editor.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File

enum class Screen { HOME, PICK, LOADING, EDIT, MASK, EXPORT }
enum class Analysis { IDLE, PROCESSING, READY, FAILED }
data class Sample(val key: String, val file: String, val titleRes: Int, val params: EditParams)

class EditorViewModel(application: Application) : AndroidViewModel(application) {
    private fun s(id: Int) = getApplication<Application>().getString(id)
    val changes = MutableStateFlow(0)
    val session = EditSession()
    val samples = listOf(
        Sample("car", "midnight-coupe", R.string.sample_car, EditParams(shape = Shape.STRAIGHT, length = 1f, sourceY = .68f)),
        Sample("portrait", "chrome-muse", R.string.sample_portrait, EditParams(shape = Shape.FAN, length = 1f, sourceY = .51f, amount = .48f)),
        Sample("flower", "electric-bloom", R.string.sample_flower, EditParams(shape = Shape.CURVE, direction = Direction.DOWN, length = 1f, sourceY = .35f, amount = .44f)),
    )
    val samplePhotos = mutableMapOf<String, Bitmap>()
    val sampleArt = mutableMapOf<String, Bitmap>()
    private val sampleMasks = mutableMapOf<String, Bitmap>()
    private val service = SubjectService(application)
    var photo: Photo? = null; private set
    var foreground: Bitmap? = null; private set
    var screen = Screen.HOME; private set
    var analysis = Analysis.IDLE; private set
    var message = ""; private set
    var exportMessage = ""; private set
    var busy = false; private set
    var exportFile: File? = null; private set
    var savedUri: Uri? = null; private set
    var snapshot: ExportSnapshot? = null; private set
    private var exportAwaitingDelivery = false
    var tool = "stretch"
    var sourceMode = false
    var maskDraft: List<MaskStroke> = emptyList(); private set
    private val maskUndo = ArrayDeque<List<MaskStroke>>()
    var draftSubject = true
    var brushSize = .07f
    var erase = false
    val canUndoMask get() = maskUndo.isNotEmpty()
    private var loadJob: Job? = null
    private var analysisJob: Job? = null
    private var analysisId = 0L
    private var sampleKey: String? = null

    init {
        File(application.cacheDir, "photos").deleteRecursively()
        File(application.cacheDir, "exports").listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86_400_000 }?.forEach { it.delete() }
        viewModelScope.launch {
            // Approved sample art/masks are precomputed with this same bundled model and renderer.
            // Opening the home screen does not initialize the inference runtime.
            for (sample in samples) {
                val bitmaps = withContext(Dispatchers.IO) {
                    listOf("${sample.file}.png", "${sample.file}-art.png", "${sample.file}-mask.png").mapIndexed { index, file ->
                        application.assets.open("samples/$file").use { stream ->
                            val source = BitmapFactory.decodeStream(stream,null,BitmapFactory.Options().apply { inSampleSize = if(index == 0) 2 else 1 })!!
                            if (index != 0) source else Bitmap.createScaledBitmap(source,480,600,true).also { if(it !== source) source.recycle() }
                        }
                    }
                }
                samplePhotos[sample.key] = bitmaps[0]; sampleArt[sample.key] = bitmaps[1]; sampleMasks[sample.key] = bitmaps[2]
                notifyChange()
            }
            viewModelScope.launch(Dispatchers.Default) {
                for (sample in samples) {
                    val source = samplePhotos[sample.key] ?: continue
                    val foreground = sampleMasks[sample.key] ?: continue
                    val preview = StretchRenderer(if ((application.getSystemService(Application.ACTIVITY_SERVICE) as android.app.ActivityManager).memoryClass < 96) 320 else 960).export(source, foreground, sample.params)
                    withContext(Dispatchers.Main) { sampleArt[sample.key] = preview; notifyChange() }
                }
            }
        }
    }

    fun notifyChange() { changes.value++ }
    fun pick() { if (!busy) { screen = Screen.PICK; notifyChange() } }
    fun cancelLoading() {
        if (screen != Screen.LOADING) return
        loadJob?.cancel(); analysisJob?.cancel(); analysisId++; session.newPhoto()
        photo?.file?.delete(); photo = null; foreground = null; snapshot = null; sampleKey = null
        screen = Screen.PICK; message = ""; analysis = Analysis.IDLE; notifyChange()
    }
    fun load(uri: Uri) = startLoad(null, EditParams()) { PhotoFiles.import(getApplication(), uri) }
    fun loadSample(key: String, preset: Boolean = true) {
        val sample = samples.first { it.key == key }
        startLoad(key, if (preset) sample.params else EditParams(shape = Shape.STRAIGHT, sourceY = sample.params.sourceY)) { PhotoFiles.sample(getApplication(), sample.file) }
    }
    private fun startLoad(key: String?, initial: EditParams, importer: () -> Photo) {
        if (busy) return
        analysisJob?.cancel(); loadJob?.cancel(); analysisId++
        photo?.file?.delete()
        val id = session.newPhoto(initial); photo = null; foreground = null; snapshot = null; sampleKey = key
        screen = Screen.LOADING; message = s(R.string.opening_photo); analysis = Analysis.IDLE
        exportFile = null; savedUri = null; tool = if (initial.shape == Shape.NONE) "shape" else "stretch"; sourceMode = false; notifyChange()
        loadJob = viewModelScope.launch {
            var imported: Photo? = null; var accepted = false
            try {
                val loaded = withContext(Dispatchers.IO) { importer().also { imported = it } }
                if (session.photoId != id) return@launch
                photo = loaded; accepted = true; screen = Screen.EDIT
                val cached = key?.let { sampleMasks[it] }
                if (cached != null) { foreground = cached; session.receive(id); analysis = Analysis.READY; message = s(R.string.subject_ready); notifyChange() }
                else { notifyChange(); analyze() }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { screen = Screen.PICK; message = e.message ?: s(R.string.photo_open_failed); notifyChange() }
            catch (_: OutOfMemoryError) { screen = Screen.PICK; message = s(R.string.photo_too_large); notifyChange() }
            finally { if (!accepted) imported?.file?.delete() }
        }
    }
    fun analyze() {
        val current = photo ?: return
        if (analysisJob?.isActive == true) return
        val id = session.photoId; val request = ++analysisId
        analysis = Analysis.PROCESSING; message = s(R.string.finding_subject); notifyChange()
        analysisJob = viewModelScope.launch {
            val started = SystemClock.elapsedRealtime()
            try {
                val mask = withContext(Dispatchers.Default) { service.analyze(current.preview) }
                if (id != session.photoId || request != analysisId) return@launch
                if (mask == null) { analysis = Analysis.FAILED; message = s(R.string.refine_subject_manually) }
                else {
                    foreground = mask; session.receive(id); analysis = Analysis.READY; message = s(R.string.subject_ready)
                    sampleKey?.let { sampleMasks[it] = mask }
                    Log.i("YourColorTiming", "photo=$id segmentationMs=${SystemClock.elapsedRealtime() - started}")
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (id == session.photoId) { analysis = Analysis.FAILED; message = s(R.string.refine_subject_manually); Log.w("YourColor", "Segmentation failed", e) } }
            catch (_: OutOfMemoryError) { if (id == session.photoId) { analysis = Analysis.FAILED; message = s(R.string.refine_subject_manually) } }
            finally { if (id == session.photoId && request == analysisId) notifyChange() }
        }
    }
    fun update(params: EditParams) { session.update(params); notifyChange() }
    fun undo() { session.undo(); notifyChange() }
    fun redo() { session.redo(); notifyChange() }
    fun openMask() { session.endGesture(); maskDraft = session.params.strokes; draftSubject = session.params.useSubject; maskUndo.clear(); screen = Screen.MASK; notifyChange() }
    fun stroke(value: MaskStroke) { maskUndo.addLast(maskDraft); if (maskUndo.size > 40) maskUndo.removeFirst(); maskDraft = maskDraft + value; notifyChange() }
    fun undoMask() { if (maskUndo.isNotEmpty()) { maskDraft = maskUndo.removeLast(); notifyChange() } }
    fun clearMaskStrokes() { if (maskDraft.isNotEmpty()) { maskUndo.addLast(maskDraft); maskDraft = emptyList(); notifyChange() } }
    fun closeMask(apply: Boolean) { if (apply) session.update(session.params.copy(strokes = maskDraft, useSubject = draftSubject)); maskDraft = emptyList(); maskUndo.clear(); screen = Screen.EDIT; notifyChange() }
    fun beginExport() {
        val p = photo ?: return
        snapshot = ExportSnapshot(p.file, session.freeze(), foreground)
        exportFile = null; savedUri = null; exportAwaitingDelivery = false; exportMessage = PhotoFiles.exportDescription(getApplication())
        screen = Screen.EXPORT; notifyChange()
    }
    fun backToEdit() { if (!busy) { session.unfreeze(); snapshot = null; exportAwaitingDelivery = false; screen = Screen.EDIT; notifyChange() } }
    fun home() {
        if (busy) return
        loadJob?.cancel(); analysisJob?.cancel(); analysisId++; session.newPhoto()
        photo?.file?.delete(); photo = null; foreground = null; snapshot = null; exportAwaitingDelivery = false
        screen = Screen.HOME; message = ""; analysis = Analysis.IDLE; notifyChange()
    }
    fun requestExport() {
        if (screen != Screen.EXPORT || busy || exportAwaitingDelivery) return
        prepareExport { file ->
            if (screen == Screen.EXPORT && file.exists()) {
                exportAwaitingDelivery = true
                notifyChange()
            }
        }
    }
    fun consumeReadyExport(): File? {
        if (screen != Screen.EXPORT || busy || !exportAwaitingDelivery) return null
        exportAwaitingDelivery = false
        return exportFile?.takeIf { it.exists() }
    }
    fun prepareExport(onReady: (File) -> Unit) {
        val snap = snapshot ?: return
        if (busy) return
        exportFile?.takeIf { it.exists() }?.let { onReady(it); return }
        busy = true; exportMessage = s(R.string.creating_export); notifyChange()
        viewModelScope.launch {
            try {
                val file = withContext(Dispatchers.Default) { PhotoFiles.renderJpeg(getApplication(), snap) }
                exportFile = file; busy = false; exportMessage = s(R.string.export_ready); notifyChange(); onReady(file)
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { busy = false; exportMessage = s(R.string.export_failed); notifyChange() }
            catch (_: OutOfMemoryError) { busy = false; exportMessage = s(R.string.out_of_memory); notifyChange() }
        }
    }
    fun save(file: File, document: Uri? = null) {
        if (busy) return
        busy = true; exportMessage = s(R.string.saving_image); notifyChange()
        viewModelScope.launch {
            try {
                savedUri = withContext(Dispatchers.IO) {
                    if (document != null) { PhotoFiles.saveToDocument(getApplication(), file, document); document }
                    else PhotoFiles.saveToGallery(getApplication(), file)
                }
                exportMessage = if (document == null) s(R.string.saved_to_gallery) else s(R.string.saved_to_location)
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { exportMessage = s(R.string.save_failed) }
            finally { busy = false; notifyChange() }
        }
    }
    fun documentCancelled() { exportMessage = s(R.string.save_cancelled); notifyChange() }
    override fun onCleared() { super.onCleared(); CoroutineScope(Dispatchers.IO).launch { service.close() } }
}
