package com.robotics.yourcolor.editor

import com.robotics.yourcolor.R

enum class Shape(val titleRes: Int) { NONE(R.string.shape_none), STRAIGHT(R.string.shape_straight), FAN(R.string.shape_fan), CURVE(R.string.shape_curve) }
enum class Direction(val titleRes: Int, val dx: Float, val dy: Float) {
    UP(R.string.direction_up, 0f, -1f), DOWN(R.string.direction_down, 0f, 1f), LEFT(R.string.direction_left, -1f, 0f), RIGHT(R.string.direction_right, 1f, 0f)
}
enum class Backdrop(val titleRes: Int) { PHOTO(R.string.backdrop_photo), INK(R.string.backdrop_ink), PAPER(R.string.backdrop_paper) }
data class BrushPoint(val x: Float, val y: Float)
data class MaskStroke(val points: List<BrushPoint>, val size: Float, val erase: Boolean)
data class EditParams(
    val shape: Shape = Shape.NONE,
    val direction: Direction = Direction.UP,
    val length: Float = .86f,
    val amount: Float = .48f,
    val sourceX: Float = .5f,
    val sourceY: Float = .55f,
    val useSubject: Boolean = true,
    val background: Backdrop = Backdrop.PHOTO,
    val strokes: List<MaskStroke> = emptyList(),
)

/** Image recognition only supplies a mask; it never changes a user's composition. */
class EditSession {
    var photoId = 0L; private set
    var params = EditParams(); private set
    var hasMask = false; private set
    var exportFrozen = false; private set
    var userEdited = false; private set
    private var gestureStart: EditParams? = null
    private val undo = ArrayDeque<EditParams>()
    private val redo = ArrayDeque<EditParams>()
    val canUndo get() = undo.isNotEmpty()
    val canRedo get() = redo.isNotEmpty()
    fun newPhoto(initial: EditParams = EditParams()): Long {
        photoId++; params = initial; hasMask = false; exportFrozen = false; userEdited = false
        undo.clear(); redo.clear(); gestureStart = null
        return photoId
    }
    fun beginGesture() { if (gestureStart == null) gestureStart = params }
    fun endGesture() {
        gestureStart?.let { if (it != params) record(it) }
        gestureStart = null
    }
    fun update(next: EditParams) {
        if (exportFrozen || next == params) return
        if (gestureStart == null) record(params)
        params = next; userEdited = true
    }
    private fun record(value: EditParams) { undo.addLast(value); if (undo.size > 40) undo.removeFirst(); redo.clear() }
    fun receive(id: Long): Boolean {
        if (id != photoId) return false
        hasMask = true; return true
    }
    fun undo() { endGesture(); if (!exportFrozen && undo.isNotEmpty()) { redo.addLast(params); params = undo.removeLast() } }
    fun redo() { endGesture(); if (!exportFrozen && redo.isNotEmpty()) { undo.addLast(params); params = redo.removeLast() } }
    fun freeze(): EditParams { endGesture(); exportFrozen = true; return params }
    fun unfreeze() { exportFrozen = false }
}
