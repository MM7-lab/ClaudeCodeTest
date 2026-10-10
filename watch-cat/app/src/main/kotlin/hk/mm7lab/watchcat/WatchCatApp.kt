package hk.mm7lab.watchcat

import android.app.Application

class WatchCatApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.channels(this)
    }
}
