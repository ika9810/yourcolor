package com.robotics.yourcolor.editor

import org.junit.Assert.*
import org.junit.Test

class EditSessionTest {
    @Test fun importedPhotoHasNoAutomaticEffect() {
        val s=EditSession();val id=s.newPhoto();s.receive(id)
        assertEquals(Shape.NONE,s.params.shape);assertFalse(s.canUndo)
    }
    @Test fun lateMaskNeverChangesComposition() {
        val s=EditSession();val id=s.newPhoto();s.update(s.params.copy(shape=Shape.FAN,direction=Direction.LEFT,length=.3f));val before=s.params
        assertTrue(s.receive(id));assertEquals(before,s.params)
    }
    @Test fun stalePhotoMaskIsDiscarded() {
        val s=EditSession();val old=s.newPhoto();s.newPhoto()
        assertFalse(s.receive(old));assertFalse(s.hasMask)
    }
    @Test fun exportIsFrozenWhileRecognitionCompletes() {
        val s=EditSession();val id=s.newPhoto();val snapshot=s.freeze();s.receive(id);s.update(snapshot.copy(length=.1f))
        assertEquals(snapshot,s.params);s.unfreeze();s.update(snapshot.copy(length=.1f));assertEquals(.1f,s.params.length)
    }
    @Test fun gestureIsOneUndoEntry() {
        val s=EditSession();s.newPhoto();val before=s.params;s.beginGesture();s.update(s.params.copy(length=.1f));s.update(s.params.copy(length=.4f));s.endGesture()
        s.undo();assertEquals(before,s.params);assertFalse(s.canUndo);s.redo();assertEquals(.4f,s.params.length)
    }
    @Test fun noMovementDoesNotPolluteHistory() {val s=EditSession();s.newPhoto();s.beginGesture();s.endGesture();assertFalse(s.canUndo)}
    @Test fun brushCommitAndUndoAreImmutable() {
        val s=EditSession();s.newPhoto();val before=s.params;val stroke=MaskStroke(listOf(BrushPoint(.5f,.5f)),.1f,false)
        s.update(before.copy(strokes=listOf(stroke)));val snapshot=s.freeze();assertEquals(listOf(stroke),snapshot.strokes)
        s.unfreeze();s.undo();assertTrue(s.params.strokes.isEmpty());assertEquals(1,snapshot.strokes.size);s.redo();assertEquals(snapshot,s.params)
    }
}
