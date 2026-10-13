package com.robotics.yourcolor

import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import com.robotics.yourcolor.editor.*
import com.robotics.yourcolor.data.PhotoFiles
import com.robotics.yourcolor.ui.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    private val model: EditorViewModel by viewModels()
    private val surface = 0xfff6f6f9.toInt(); private val ink = 0xff1c1c1e.toInt()
    private val blue = 0xff0866e9.toInt(); private val gray = 0xff74747c.toInt()
    private val privacyUrl = "https://ika9810.github.io/yourcolor-privacy/"
    private val regular by lazy { Typeface.createFromAsset(assets, "fonts/Paperlogy-4Regular.ttf") }
    private val semi by lazy { Typeface.createFromAsset(assets, "fonts/Paperlogy-6SemiBold.ttf") }
    private val bold by lazy { Typeface.createFromAsset(assets, "fonts/Paperlogy-7Bold.ttf") }
    private lateinit var root: FrameLayout
    private var pageKey = ""
    private var previousScreen: Screen? = null
    private var previousPhotoId = -1L
    private val scrollOffsets = mutableMapOf<Screen, List<Int>>()
    private var folding: FoldingFeature? = null
    private var art: PhotoCanvas? = null
    private var status: TextView? = null
    private var exportStatus: TextView? = null
    private var length: SeekBar? = null
    private var amount: SeekBar? = null
    private var amountValue: TextView? = null
    private var lengthValue: TextView? = null
    private var undo: View? = null; private var redo: View? = null
    private var save: View? = null
    private var compare: View? = null
    private var sourceButton: TextView? = null
    private val maskHint get() = getString(R.string.mask_hint)
    private val choices = mutableListOf<Pair<View, () -> Boolean>>()
    private val directionLabels = mutableListOf<Triple<View, TextView, TextView>>()
    private val shapeChoices = mutableListOf<Pair<View, Shape>>()
    private val backdropChoices = mutableListOf<Pair<View, Backdrop>>()
    private val thumbnails = mutableListOf<Pair<PhotoCanvas, Shape>>()
    private val sampleViews = mutableListOf<Triple<ImageView, String, Boolean>>()
    private val controls = mutableListOf<View>()
    private val picker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? -> if (uri != null) model.load(uri) }
    private val document = registerForActivityResult(ActivityResultContracts.CreateDocument("image/jpeg")) { uri ->
        if (uri == null) model.documentCancelled() else model.exportFile?.let { model.save(it, uri) }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply { isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = Build.VERSION.SDK_INT >= 26 }
        root = FrameLayout(this).apply { setBackgroundColor(surface) }; setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        root.addOnLayoutChangeListener { _, l, t, r, b, ol, ot, or, ob -> if (r-l != or-ol || b-t != ob-ot) render() }
        lifecycleScope.launch { repeatOnLifecycle(Lifecycle.State.STARTED) { model.changes.collect { render(); deliverExportIfReady() } } }
        lifecycleScope.launch { repeatOnLifecycle(Lifecycle.State.STARTED) { WindowInfoTracker.getOrCreate(this@MainActivity).windowLayoutInfo(this@MainActivity).collect { info ->
            val next = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull { it.isSeparating || it.occlusionType == FoldingFeature.OcclusionType.FULL }
            if (next?.bounds != folding?.bounds || next?.state != folding?.state) { folding = next; pageKey = ""; render() }
        } } }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { back() } })
    }
    private fun availableWidth() = (root.width - root.paddingLeft - root.paddingRight).takeIf { it > 0 } ?: resources.displayMetrics.widthPixels
    private fun availableHeight() = (root.height - root.paddingTop - root.paddingBottom).takeIf { it > 0 } ?: resources.displayMetrics.heightPixels
    private fun dp(v: Int) = (v * resources.displayMetrics.density).roundToInt()
    private fun wide() = availableWidth() >= dp(700) || (availableWidth() >= dp(600) && availableWidth() > availableHeight() * 1.3f)
    private fun render() {
        val key = "${model.screen}/${model.session.photoId}/${model.tool}/${availableWidth()}/${availableHeight()}/${folding?.bounds}"
        if (key != pageKey) {
            if (previousPhotoId != model.session.photoId) scrollOffsets.clear()
            else previousScreen?.let { scrollOffsets[it] = scrollViews(root).map { view -> view.scrollY } }
            previousScreen = model.screen; previousPhotoId = model.session.photoId
            val offsets = scrollOffsets[model.screen]
            pageKey = key; root.removeAllViews(); art = null; status = null; exportStatus = null; length = null; amount = null; amountValue = null; lengthValue = null; undo = null; redo = null; save = null; compare = null; sourceButton = null
            choices.clear(); directionLabels.clear(); shapeChoices.clear(); backdropChoices.clear(); thumbnails.clear(); sampleViews.clear(); controls.clear()
            when (model.screen) {
                Screen.HOME -> homeScreen()
                Screen.PICK -> pickerScreen()
                Screen.LOADING -> loadingScreen()
                Screen.EDIT -> editorScreen()
                Screen.MASK -> maskScreen()
                Screen.EXPORT -> exportScreen()
            }
            if (offsets != null) root.post { if (pageKey == key) scrollViews(root).zip(offsets).forEach { (view, y) -> view.scrollTo(0, y) } }
        }
        refresh()
    }
    private fun scrollViews(view: View): List<ScrollView> {
        val own = if (view is ScrollView) listOf(view) else emptyList()
        return own + if (view is ViewGroup) (0 until view.childCount).flatMap { scrollViews(view.getChildAt(it)) } else emptyList()
    }
    private fun refresh() {
        val params = model.session.params
        art?.apply {
            photo = model.photo?.preview
            mask = if (model.screen == Screen.EXPORT) model.snapshot?.foreground else model.foreground
            this.params = when(model.screen) { Screen.EXPORT -> model.snapshot?.params ?: params; Screen.MASK -> params.copy(strokes = model.maskDraft); else -> params }
            sourceMode = model.sourceMode; brushSize = model.brushSize; erase = model.erase
            invalidate()
        }
        status?.text = if (model.screen == Screen.MASK && model.analysis == Analysis.READY) maskHint else model.message
        exportStatus?.text = model.exportMessage.takeUnless { it.startsWith("JPG") } ?: ""
        length?.let { if (!it.isPressed) it.progress = (params.length * 100).roundToInt() }
        amount?.let { if (!it.isPressed) it.progress = (params.amount * 100).roundToInt() }
        amountValue?.text = "${(params.amount*100).roundToInt()}"
        lengthValue?.text = "${(params.length * 100).roundToInt()}"
        sourceButton?.text = if (model.sourceMode) getString(R.string.source_finish) else getString(R.string.change_start_line)
        undo?.apply { isEnabled = if (model.screen == Screen.MASK) model.canUndoMask else model.session.canUndo; alpha = if (isEnabled) 1f else .25f }
        redo?.apply { isEnabled = model.session.canRedo; alpha = if (isEnabled) 1f else .25f }
        controls.forEach { it.isEnabled = !model.busy; it.alpha = if (model.busy) .4f else 1f }
        choices.forEach { (view, selected) ->
            val active = selected(); view.background = bg(if (active) Color.WHITE else Color.TRANSPARENT, 16)
            if (view is TextView) view.setTextColor(if (active) blue else gray)
            view.isSelected = active
        }
        directionLabels.forEach { (view, arrow, label) ->
            val color = if (view.isSelected) blue else gray
            arrow.setTextColor(color); label.setTextColor(color)
        }
        shapeChoices.forEach { (view, shape) ->
            view.foreground = GradientDrawable().apply { setColor(Color.TRANSPARENT); cornerRadius=dp(15).toFloat(); setStroke(dp(2),if(params.shape==shape) blue else Color.TRANSPARENT) }
        }
        backdropChoices.forEach { (view, background) ->
            view.foreground = GradientDrawable().apply { shape=GradientDrawable.OVAL; setColor(Color.TRANSPARENT); setStroke(dp(2),if(params.background==background) blue else Color.TRANSPARENT) }
        }
        thumbnails.forEach { (view, shape) ->
            view.photo=model.photo?.preview; view.mask=model.foreground
            view.params=params.copy(shape=shape,amount=if(shape==Shape.STRAIGHT)0f else .65f)
            view.invalidate()
        }
        sampleViews.forEach { (view, key, effect) -> view.setImageBitmap((if (effect) model.sampleArt[key] else null) ?: model.samplePhotos[key]) }
    }
    private fun col() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    private fun text(value: String, size: Int = 16, color: Int = ink, weight: Int = 400) = TextView(this).apply {
        this.text = value; textSize = size.toFloat(); setTextColor(color); typeface = when(weight) {700->bold;600->semi;else->regular}
        includeFontPadding = false; setLineSpacing(dp(3).toFloat(), 1f); letterSpacing = -.025f
    }
    private fun bg(color: Int, radius: Int = 24) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat() }
    private fun click(view: View, label: String, action: () -> Unit): View {
        view.isClickable = true; view.isFocusable = true; view.contentDescription = label
        view.setOnClickListener { action() }; return view
    }
    private fun button(label: String, primary: Boolean = true, action: () -> Unit): TextView = text(label,16,if(primary) Color.WHITE else blue,600).apply {
        gravity = Gravity.CENTER; minHeight = dp(54); setPadding(dp(16),dp(13),dp(16),dp(13))
        background = RippleDrawable(ColorStateList.valueOf(0x22000000),bg(if(primary)blue else Color.WHITE,28),null)
        click(this,label,action)
    }
    private fun icon(name: String, label: String, action: () -> Unit): View = IconView(this,name).apply {
        background = RippleDrawable(ColorStateList.valueOf(0x16000000),bg(Color.WHITE,28),null); click(this,label,action)
        layoutParams = LinearLayout.LayoutParams(dp(44),dp(44))
    }
    private fun space(parent: LinearLayout, value: Int) { parent.addView(View(this),LinearLayout.LayoutParams(1,dp(value))) }
    private fun scroll(content: View) = ScrollView(this).apply { isFillViewport = true; clipToPadding = false; isVerticalScrollBarEnabled = false; addView(content,ViewGroup.LayoutParams(-1,-2)) }
    private fun addRoot(view: View) { root.addView(view,FrameLayout.LayoutParams(-1,-1)) }
    private fun capped(content: View, max: Int = 480): View = FrameLayout(this).apply { addView(content,FrameLayout.LayoutParams(minOf(availableWidth(),dp(max)),-2,Gravity.TOP or Gravity.CENTER_HORIZONTAL)) }
    private fun header(title: String, onBack: () -> Unit, action: View? = null): View = row().apply {
        setPadding(dp(28),dp(7),dp(28),dp(7)); addView(icon("back",getString(R.string.back),onBack))
        addView(text(title,17,ink,600).apply { gravity=Gravity.CENTER },LinearLayout.LayoutParams(0,-1,1f))
        addView(action ?: View(this@MainActivity),LinearLayout.LayoutParams(if(action is TextView) dp(64) else dp(44),if(action is TextView) dp(40) else dp(44)).apply { gravity=Gravity.CENTER_VERTICAL })
    }
    private fun page(title: String, back: () -> Unit, action: View? = null): LinearLayout = col().apply { addRoot(this); addView(header(title,back,action),LinearLayout.LayoutParams(-1,dp(64))) }
    private fun showPrivacyPolicy() {
        val language = resources.configuration.locales[0].language
        val policyFile = if (language == "ko") "privacy-policy.txt" else "privacy-policy-en.txt"
        val policy = assets.open(policyFile).bufferedReader().use { it.readText() }
        val body = text(policy,14).apply { setPadding(dp(24),dp(12),dp(24),dp(24)) }
        AlertDialog.Builder(this).setTitle(getString(R.string.privacy_policy))
            .setView(ScrollView(this).apply { addView(body) })
            .setNeutralButton(getString(R.string.view_on_web)) { _, _ ->
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(privacyUrl)))
                } catch (_: ActivityNotFoundException) {
                    Toast.makeText(this, getString(R.string.browser_unavailable), Toast.LENGTH_SHORT).show()
                }
            }
            .setPositiveButton(getString(R.string.close),null).show()
    }
    private fun homeScreen() {
        val availableDp=availableHeight()/resources.displayMetrics.density
        val compact=availableDp<700f && !wide()
        val short=availableDp<650f && !wide()
        val content = col().apply { clipChildren=false; clipToPadding=false; setPadding(dp(29),0,dp(29),dp(24)) }
        content.addView(ArtworkView(this),LinearLayout.LayoutParams(dp(146),dp(30)).apply { topMargin=dp(if(short)12 else if(compact)20 else 27); bottomMargin=dp(if(short)20 else if(compact)32 else 53) })
        val width = minOf(availableWidth()-dp(58),dp(390))
        val stackHeight = dp(if(short)202 else if(compact)228 else 278)
        val stack = FrameLayout(this).apply { clipChildren = false; clipToPadding = false }
        fun card(key: String, x: Float, y: Int, angle: Float) {
            val cardW = (width * (if(compact).52f else .60f)).roundToInt(); val cardH = dp(if(short)166 else if(compact)190 else 228)
            val outer = PhotoCardView(this).apply {
                rotation = angle
                click(this,getString(R.string.sample_open_artwork, getString(model.samples.first { it.key==key }.titleRes))) { model.loadSample(key) }
            }
            val image = ImageView(this).apply { scaleType=ImageView.ScaleType.CENTER_CROP; importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO }
            outer.addView(image,FrameLayout.LayoutParams(-1,-1)); sampleViews.add(Triple(image,key,true))
            stack.addView(outer,FrameLayout.LayoutParams(cardW,cardH).apply { leftMargin=(width*x).roundToInt(); topMargin=dp(y) })
        }
        card("flower",.02f,if(compact)8 else 14,-12f); card("car",if(compact).46f else .40f,if(short)20 else if(compact)25 else 35,10f); card("portrait",if(compact).24f else .23f,if(short)30 else if(compact)35 else 48,3f)
        content.addView(stack,LinearLayout.LayoutParams(-1,stackHeight))
        val headlineGap=if(short)18 else if(compact)30 else (availableDp-746f).roundToInt().coerceIn(40,120)
        space(content,headlineGap)
        content.addView(text(getString(R.string.home_headline),34,ink,700).apply { gravity=Gravity.CENTER; setLineSpacing(dp(1).toFloat(),1f) })
        space(content,if(short)10 else 14)
        content.addView(text(getString(R.string.home_subtitle),17,gray).apply { gravity=Gravity.CENTER; setLineSpacing(dp(7).toFloat(),1f) })
        // Keep the CTA near the bottom as the headline moves away from the artwork.
        val ctaSpace = if(short)12 else if(compact)20 else (availableDp-609f-headlineGap).roundToInt().coerceIn(20,if(wide())160 else 80)
        space(content,ctaSpace)
        content.addView(button(getString(R.string.start_with_photo)) { model.pick() }.apply { id=R.id.start_photo },LinearLayout.LayoutParams(-1,-2))
        space(content,12)
        content.addView(text(getString(R.string.privacy_policy),12,gray).apply { gravity=Gravity.CENTER; minHeight=dp(44); click(this,getString(R.string.view_privacy_policy)) { showPrivacyPolicy() } })
        val holder = capped(content,460)
        addRoot(scroll(holder))
    }
    private fun pickerScreen() {
        val page = page(getString(R.string.new_artwork),{model.home()})
        val body = col().apply { setPadding(dp(24),dp(8),dp(24),dp(32)) }
        body.addView(text(getString(R.string.pick_headline),32,ink,700)); space(body,12)
        body.addView(text(getString(R.string.pick_subtitle),15,gray)); space(body,24)
        val import = row().apply {
            background=bg(Color.WHITE,25); setPadding(dp(16),dp(15),dp(16),dp(15)); minimumHeight=dp(88)
            addView(IconView(this@MainActivity,"plus",blue),LinearLayout.LayoutParams(dp(38),dp(38)))
            addView(col().apply { setPadding(dp(12),0,0,0); addView(text(getString(R.string.choose_my_photo),17,ink,600)); space(this,7); addView(text(getString(R.string.import_from_gallery),13,gray)) },LinearLayout.LayoutParams(0,-2,1f))
            addView(IconView(this@MainActivity,"right",gray),LinearLayout.LayoutParams(dp(26),dp(26)))
            id=R.id.pick_photo; click(this,getString(R.string.choose_my_photo)) { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
        }
        body.addView(import); space(body,22)
        body.addView(row().apply {
            addView(text(getString(R.string.try_a_sample),16,ink,600),LinearLayout.LayoutParams(0,-2,1f))
            addView(text(getString(R.string.three_photos),12,gray))
        }); space(body,12)
        fun sampleCard(key: String, imageHeight: Int): View = col().apply {
            background=bg(Color.WHITE,24); clipToOutline=true
            val image=FocalImageView(this@MainActivity,when(key){"car"->.70f;"flower"->.25f;else->.37f})
            sampleViews.add(Triple(image,key,false)); addView(image,LinearLayout.LayoutParams(-1,dp(imageHeight)))
            addView(text(getString(model.samples.first { it.key==key }.titleRes),13,ink,600).apply { setPadding(dp(13),dp(15),dp(8),dp(15)) })
            click(this,getString(R.string.sample_choose_photo, getString(model.samples.first { it.key==key }.titleRes))) { model.loadSample(key,false) }
        }
        body.addView(sampleCard("car",154)); space(body,12)
        body.addView(row().apply {
            addView(sampleCard("portrait",174),LinearLayout.LayoutParams(0,-2,1f).apply { rightMargin=dp(6) })
            addView(sampleCard("flower",174),LinearLayout.LayoutParams(0,-2,1f).apply { leftMargin=dp(6) })
        }); space(body,23)
        body.addView(text(getString(R.string.pick_note),12,gray).apply { setLineSpacing(dp(6).toFloat(),1f) })
        if(model.message.isNotEmpty() && model.photo==null) { space(body,12); body.addView(text(model.message,13,blue)) }
        page.addView(scroll(capped(body,560)),LinearLayout.LayoutParams(-1,0,1f))
    }
    private fun loadingScreen() {
        val page=page(getString(R.string.preparing_photo),{model.cancelLoading()})
        val body=FrameLayout(this)
        val center=col().apply { gravity=Gravity.CENTER;setPadding(dp(24),0,dp(24),0)
            addView(ProgressBar(this@MainActivity).apply {indeterminateTintList=ColorStateList.valueOf(blue)},LinearLayout.LayoutParams(dp(42),dp(42)).apply{gravity=Gravity.CENTER_HORIZONTAL})
            space(this,24)
            addView(text(getString(R.string.preparing_photo_message),23,ink,700).apply{gravity=Gravity.CENTER})
            space(this,9)
            status=text(model.message,14,gray).apply{gravity=Gravity.CENTER};addView(status)
        }
        body.addView(center,FrameLayout.LayoutParams(-1,-2,Gravity.CENTER))
        body.addView(text(getString(R.string.cancel),14,gray,600).apply {gravity=Gravity.CENTER;click(this,getString(R.string.cancel_photo_import)){model.cancelLoading()}},FrameLayout.LayoutParams(-1,dp(48),Gravity.BOTTOM).apply{bottomMargin=dp(24)})
        page.addView(body,LinearLayout.LayoutParams(-1,0,1f))
    }
    private fun preview(editable: Boolean, maskMode: Boolean = false): View {
        val holder=FrameLayout(this)
        art=PhotoCanvas(this).apply {
            id=R.id.effect_preview; this.editable=editable; this.maskMode=maskMode
            onChange={model.update(it)}; onGestureStart={model.session.beginGesture()}; onGestureEnd={model.session.endGesture();model.notifyChange()}; onStroke={model.stroke(it)}
        }
        holder.addView(art,FrameLayout.LayoutParams(-1,-2))
        if(editable && !maskMode) {
            compare=icon("eye",getString(R.string.compare_original)){art?.let { it.original=!it.original;it.invalidate();compare?.isSelected=it.original;compare?.contentDescription=if(it.original)getString(R.string.view_edit) else getString(R.string.compare_original) }}
            holder.addView(compare,FrameLayout.LayoutParams(dp(34),dp(34),Gravity.TOP or Gravity.END).apply { topMargin=dp(12);rightMargin=dp(12) })
            status=text(model.message,12,ink,400).apply {
                id=R.id.status_message; gravity=Gravity.CENTER; setPadding(dp(11),dp(8),dp(11),dp(8)); background=bg(0xf5ffffff.toInt(),16); minimumHeight=dp(30)
                click(this,getString(R.string.refine_subject)){model.openMask()}
            }
            holder.addView(status,FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM or Gravity.START).apply { bottomMargin=dp(12);leftMargin=dp(12) })
        }
        return holder
    }
    private fun editorScreen() {
        val saveButton=button(getString(R.string.save)){model.beginExport()}.apply {id=R.id.open_export;minHeight=0;setPadding(0,0,0,0);textSize=15f;background=bg(blue,23)}
        val page=page(getString(R.string.create),{leaveEditor()},saveButton)
        val image=col().apply {setPadding(dp(24),0,dp(24),0);addView(preview(true));addView(row().apply {
            addView(text(getString(R.string.canvas_hint),11,gray),LinearLayout.LayoutParams(0,-2,1f))
            undo=icon("undo",getString(R.string.undo)){model.undo()};redo=icon("redo",getString(R.string.redo)){model.redo()}
            addView(undo,LinearLayout.LayoutParams(dp(44),dp(48)));addView(redo,LinearLayout.LayoutParams(dp(44),dp(48)))
        })}
        val tools=editorTools()
        adaptive(page,image,tools)
    }
    private fun adaptive(page: LinearLayout, image: View, tools: View) {
        val fold=folding
        if(fold?.orientation==FoldingFeature.Orientation.HORIZONTAL) {
            val topHeight=(fold.bounds.top-root.paddingTop-dp(68)).coerceAtLeast(dp(150))
            val body=col(); val w=minOf(availableWidth()-dp(24),((topHeight-dp(8))*.8f).roundToInt())
            body.addView(scroll(FrameLayout(this).apply {addView(image,FrameLayout.LayoutParams(w,-2,Gravity.CENTER_HORIZONTAL))}),LinearLayout.LayoutParams(-1,topHeight))
            body.addView(View(this),LinearLayout.LayoutParams(-1,maxOf(dp(12),fold.bounds.height())))
            body.addView(scroll(tools),LinearLayout.LayoutParams(-1,0,1f));page.addView(body,LinearLayout.LayoutParams(-1,0,1f))
        } else if(wide()) {
            val body=row().apply {gravity=Gravity.TOP}
            val hinge=fold?.takeIf {it.orientation==FoldingFeature.Orientation.VERTICAL}?.bounds
            val leftWidth=hinge?.left?.minus(root.paddingLeft) ?: (availableWidth()*.58f).roundToInt()
            val gap=hinge?.width()?.coerceAtLeast(dp(12)) ?: dp(16)
            val imageWidth=minOf(leftWidth, ((availableHeight()-dp(68)-dp(64))*.8f).roundToInt()+dp(24)).coerceAtLeast(dp(200))
            val frame=FrameLayout(this).apply{addView(image,FrameLayout.LayoutParams(imageWidth,-2,Gravity.CENTER_HORIZONTAL))}
            body.addView(scroll(frame),LinearLayout.LayoutParams(leftWidth,-1))
            body.addView(View(this),LinearLayout.LayoutParams(gap,1))
            body.addView(scroll(tools),LinearLayout.LayoutParams(0,-1,1f));page.addView(body,LinearLayout.LayoutParams(-1,0,1f))
        } else {
            val body=col();body.addView(image);body.addView(tools);page.addView(scroll(body),LinearLayout.LayoutParams(-1,0,1f))
        }
    }
    private fun editorTools(): View {
        val body=col().apply {setPadding(dp(24),dp(7),dp(24),dp(18))}
        val p=model.session.params
        when(model.tool) {
            "stretch" -> {
                val heading=row();heading.addView(text(getString(R.string.stretch_direction),15,ink,600),LinearLayout.LayoutParams(0,-2,1f))
                sourceButton=text(getString(R.string.change_start_line),12,blue).apply {gravity=Gravity.CENTER;minimumHeight=dp(44);click(this,getString(R.string.change_start_line)){model.sourceMode=!model.sourceMode;model.notifyChange()}}
                heading.addView(sourceButton);body.addView(heading)
                val buttons=segments();Direction.entries.forEach { direction ->
                    val arrow=when(direction){Direction.UP->"↑";Direction.DOWN->"↓";Direction.LEFT->"←";Direction.RIGHT->"→"}
                    val view=row().apply {gravity=Gravity.CENTER;minimumHeight=dp(44)
                        val symbol=text(arrow,19,gray).apply{gravity=Gravity.CENTER};val label=text(getString(direction.titleRes),12,gray).apply{gravity=Gravity.CENTER}
                        addView(symbol);addView(label,LinearLayout.LayoutParams(-2,-2).apply{leftMargin=dp(5)})
                        directionLabels.add(Triple(this,symbol,label))
                        click(this,getString(R.string.direction_action, getString(direction.titleRes))) {model.update(model.session.params.copy(direction=direction,shape=if(model.session.params.shape==Shape.NONE)Shape.STRAIGHT else model.session.params.shape))}
                    }
                    choices.add(view to {model.session.params.direction==direction})
                    buttons.addView(view,LinearLayout.LayoutParams(0,dp(44),1f))
                };body.addView(buttons)
                val r=row();r.addView(text(getString(R.string.length),13).apply {gravity=Gravity.CENTER_VERTICAL},LinearLayout.LayoutParams(dp(64),dp(48)))
                lengthValue=text("",13,gray).apply {gravity=Gravity.CENTER};r.addView(lengthValue,LinearLayout.LayoutParams(dp(36),dp(48)))
                length=slider(p.length){model.update(model.session.params.copy(length=it,shape=if(model.session.params.shape==Shape.NONE)Shape.STRAIGHT else model.session.params.shape))}.apply {id=R.id.effect_length}
                r.addView(length,LinearLayout.LayoutParams(0,dp(48),1f));body.addView(r)
                if(p.shape==Shape.NONE){body.addView(text(getString(R.string.direction_hint),12,gray));space(body,10)}
            }
            "shape" -> {
                body.addView(row().apply {addView(text(getString(R.string.stretch_shape),15,ink,600),LinearLayout.LayoutParams(0,dp(44),1f));addView(text(getString(R.string.reset),12,blue).apply {gravity=Gravity.CENTER;minimumHeight=dp(44);click(this,getString(R.string.reset_effect)){model.update(model.session.params.copy(shape=Shape.NONE))}})})
                val list=row().apply {gravity=Gravity.CENTER_VERTICAL}
                listOf(Shape.STRAIGHT,Shape.FAN,Shape.CURVE).forEachIndexed { index,s ->
                    val tile=FrameLayout(this).apply {
                        background=bg(0xffe9e9ee.toInt(),15);clipToOutline=true
                        val thumb=PhotoCanvas(this@MainActivity).apply{editable=false;importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO}
                        thumbnails.add(thumb to s)
                        addView(thumb,FrameLayout.LayoutParams(-1,dp(130),Gravity.CENTER))
                        addView(text(getString(s.titleRes),13,Color.WHITE,600).apply {gravity=Gravity.CENTER;setShadowLayer(dp(5).toFloat(),0f,dp(1).toFloat(),Color.BLACK)},FrameLayout.LayoutParams(-1,-1))
                        click(this,getString(R.string.shape_action, getString(s.titleRes))) {model.update(model.session.params.copy(shape=s,amount=if(s==Shape.STRAIGHT)0f else .65f));pageKey="";render()}
                    }
                    shapeChoices.add(tile to s)
                    list.addView(tile,LinearLayout.LayoutParams(0,dp(55),1f).apply {if(index>0)leftMargin=dp(8)})
                };body.addView(list)
                body.addView(row().apply {addView(text(if(p.shape==Shape.CURVE)getString(R.string.curve_amount) else getString(R.string.end_spread),12).apply{gravity=Gravity.CENTER_VERTICAL},LinearLayout.LayoutParams(dp(104),dp(42)));amountValue=text("${(p.amount*100).roundToInt()}",12,gray);addView(amountValue,LinearLayout.LayoutParams(dp(23),-2));amount=slider(p.amount){model.update(model.session.params.copy(amount=it))};amount?.isEnabled=p.shape!=Shape.STRAIGHT;addView(amount,LinearLayout.LayoutParams(0,dp(42),1f))})
            }
            "background" -> {
                body.addView(text(getString(R.string.choose_background),15,ink,600).apply {setPadding(0,dp(10),0,dp(10))})
                val list=row();Backdrop.entries.forEach { b ->
                    val item=col().apply {gravity=Gravity.CENTER
                        val swatch=FrameLayout(this@MainActivity).apply {
                            background=when(b){
                                Backdrop.INK->GradientDrawable().apply{shape=GradientDrawable.OVAL;setColor(0xff17211a.toInt())}
                                Backdrop.PAPER->GradientDrawable().apply{shape=GradientDrawable.OVAL;setColor(0xffeee6d7.toInt())}
                                Backdrop.PHOTO->GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xffbac1d8.toInt(),0xffe5c9ae.toInt())).apply{shape=GradientDrawable.OVAL}
                            }
                            backdropChoices.add(this to b)
                        }
                        addView(swatch,LinearLayout.LayoutParams(dp(48),dp(48)))
                        space(this,5);addView(text(getString(b.titleRes),12,ink).apply{gravity=Gravity.CENTER})
                        click(this,getString(R.string.backdrop_action, getString(b.titleRes))) {model.update(model.session.params.copy(background=b))}
                    }
                    list.addView(item,LinearLayout.LayoutParams(0,dp(78),1f))
                };body.addView(list)
                body.addView(text(getString(R.string.background_hint),12,gray).apply{gravity=Gravity.CENTER;setPadding(0,dp(5),0,dp(9))})
            }
        }
        space(body,8)
        val tabs=segments().apply {background=bg(Color.WHITE,24);setPadding(dp(4),dp(4),dp(4),dp(4))}
        for((key,title) in listOf("stretch" to getString(R.string.tab_stretch),"shape" to getString(R.string.tab_shape),"subject" to getString(R.string.tab_subject),"background" to getString(R.string.tab_background))) {
            val tab=col().apply {gravity=Gravity.CENTER;setPadding(0,dp(9),0,dp(9));background=bg(if(model.tool==key)0xffedf2fe.toInt() else Color.TRANSPARENT,20)
                addView(IconView(this@MainActivity,key,if(model.tool==key)blue else gray),LinearLayout.LayoutParams(dp(24),dp(24)));space(this,5);addView(text(title,11,if(model.tool==key)blue else gray,600).apply { gravity=Gravity.CENTER })
                click(this,title){if(key=="subject")model.openMask() else {model.tool=key;model.notifyChange()}}
            };tabs.addView(tab,LinearLayout.LayoutParams(0,-2,1f))
        };body.addView(tabs)
        return body
    }
    private fun segments()=row().apply {background=bg(0xffe9e9ef.toInt(),20);setPadding(dp(4),dp(4),dp(4),dp(4))}
    private fun choice(parent: LinearLayout,label: String, selected: ()->Boolean, action:()->Unit) {
        val view=text(label,13,gray,600).apply {gravity=Gravity.CENTER;minHeight=dp(48);setPadding(dp(3),dp(9),dp(3),dp(9));click(this,label,action)}
        choices.add(view to selected);parent.addView(view,LinearLayout.LayoutParams(0,-2,1f))
    }
    private fun slider(value: Float, onChange:(Float)->Unit): SeekBar = SeekBar(this).apply {
        max=100;progress=(value*100).roundToInt();progressTintList=ColorStateList.valueOf(blue);thumbTintList=ColorStateList.valueOf(Color.WHITE);minimumHeight=dp(48)
        setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar:SeekBar,v:Int,user:Boolean){if(user)onChange(v/100f)}
            override fun onStartTrackingTouch(bar:SeekBar){model.session.beginGesture()}
            override fun onStopTrackingTouch(bar:SeekBar){model.session.endGesture();model.notifyChange()}
        })
    }
    private fun maskScreen() {
        val done=button(getString(R.string.done)){model.closeMask(true)}.apply {id=R.id.mask_apply;minHeight=0;setPadding(0,0,0,0);textSize=15f;background=bg(blue,23)}
        val page=page(getString(R.string.refine_subject),{model.closeMask(false)},done)
        val image=col().apply {setPadding(dp(24),0,dp(24),0);addView(preview(true,true));space(this,12)
            status=text(maskHint,12,gray).apply{gravity=Gravity.CENTER;setLineSpacing(dp(4).toFloat(),1f)};addView(status)
        }
        val tools=col().apply {setPadding(dp(24),dp(20),dp(24),dp(24))}
        val panel=col().apply {background=bg(Color.WHITE,24);setPadding(dp(16),dp(16),dp(16),dp(16))}
        val actions=segments()
        choice(actions,getString(R.string.find_again),{false}){model.analyze()}
        choice(actions,getString(R.string.protect),{!model.erase}){model.erase=false;model.notifyChange()}
        choice(actions,getString(R.string.erase),{model.erase}){model.erase=true;model.notifyChange()}
        panel.addView(actions,LinearLayout.LayoutParams(-1,dp(52)))
        space(panel,18)
        panel.addView(row().apply {
            addView(text(getString(R.string.brush_size),14,ink,600).apply{gravity=Gravity.CENTER_VERTICAL},LinearLayout.LayoutParams(0,dp(44),1f))
            undo=icon("undo",getString(R.string.undo_brush)){model.undoMask()};addView(undo,LinearLayout.LayoutParams(dp(44),dp(44)))
            addView(text(getString(R.string.clear_brush),12,blue,600).apply{gravity=Gravity.CENTER_VERTICAL;click(this,getString(R.string.clear_brush)){model.clearMaskStrokes()}},LinearLayout.LayoutParams(-2,dp(44)).apply{leftMargin=dp(8)})
        },LinearLayout.LayoutParams(-1,dp(44)))
        panel.addView(slider((model.brushSize-.015f)/.185f){model.brushSize=.015f+it*.185f;model.notifyChange()}.apply{thumbTintList=ColorStateList.valueOf(blue)},LinearLayout.LayoutParams(-1,dp(44)))
        space(panel,12)
        panel.addView(View(this).apply{setBackgroundColor(0xffededf1.toInt())},LinearLayout.LayoutParams(-1,dp(1)))
        space(panel,10)
        panel.addView(row().apply {
            addView(text(getString(R.string.keep_subject_front),14,ink,600).apply{gravity=Gravity.CENTER_VERTICAL},LinearLayout.LayoutParams(0,dp(48),1f))
            val badge=text(if(model.draftSubject)getString(R.string.on) else getString(R.string.off),12,blue,600).apply{gravity=Gravity.CENTER;setPadding(dp(12),dp(7),dp(12),dp(7));background=bg(0xffebf2ff.toInt(),15)}
            addView(badge)
            click(this,getString(R.string.keep_subject_front)) {model.draftSubject=!model.draftSubject;badge.text=if(model.draftSubject)getString(R.string.on) else getString(R.string.off);model.notifyChange()}
        },LinearLayout.LayoutParams(-1,dp(48)))
        tools.addView(panel)
        adaptive(page,image,tools)
    }
    private fun exportScreen() {
        val page=page(getString(R.string.my_artwork),{model.backToEdit()},icon("close",getString(R.string.go_home)){model.home()})
        val image=col().apply {setPadding(dp(24),0,dp(24),0);addView(preview(false))}
        val tools=col().apply {setPadding(dp(24),dp(25),dp(24),dp(24));gravity=Gravity.CENTER_HORIZONTAL}
        tools.addView(text(getString(R.string.export_headline),29,ink,700).apply{gravity=Gravity.CENTER});space(tools,12)
        tools.addView(text(getString(R.string.export_subtitle),15,gray).apply{gravity=Gravity.CENTER});space(tools,20)
        tools.addView(text(PhotoFiles.exportDescription(this),11,gray).apply{gravity=Gravity.CENTER})
        exportStatus=text("",12,gray).apply{gravity=Gravity.CENTER;accessibilityLiveRegion=View.ACCESSIBILITY_LIVE_REGION_POLITE};tools.addView(exportStatus);space(tools,24)
        save=button(getString(R.string.save_image)){model.requestExport()}.apply{id=R.id.save_image};tools.addView(save,LinearLayout.LayoutParams(-1,-2));controls.add(save!!)
        space(tools,10);val back=text(getString(R.string.keep_editing),14,gray).apply{gravity=Gravity.CENTER;minimumHeight=dp(45);click(this,getString(R.string.keep_editing)){model.backToEdit()}};tools.addView(back,LinearLayout.LayoutParams(-1,-2));controls.add(back)
        adaptive(page,image,tools)
    }
    private fun deliverExportIfReady() {
        val file = model.consumeReadyExport() ?: return
        if (Build.VERSION.SDK_INT >= 29) model.save(file) else document.launch(file.name)
    }
    private fun leaveEditor() {
        if(model.busy)return
        model.pick()
    }
    private fun back() {if(model.busy)return;when(model.screen){Screen.HOME->finish();Screen.PICK->model.home();Screen.LOADING->model.cancelLoading();Screen.EDIT->leaveEditor();Screen.MASK->model.closeMask(false);Screen.EXPORT->model.backToEdit()}}
}
