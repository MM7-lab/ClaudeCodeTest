package hk.mm7lab.watchcat

import android.app.Application

class PhoneCatApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.channels(this)
    }
}
