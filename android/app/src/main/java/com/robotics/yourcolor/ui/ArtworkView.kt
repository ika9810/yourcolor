package com.robotics.yourcolor.ui

import android.content.Context
import android.widget.ImageView
import com.robotics.yourcolor.R

/** Displays the shared wordmark without redrawing its letters in app code. */
class ArtworkView(context: Context) : ImageView(context) {
    init {
        contentDescription = "yourcolor"
        setImageResource(R.drawable.yourcolor_wordmark)
        scaleType = ScaleType.FIT_START
    }
}
