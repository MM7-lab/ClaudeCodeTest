package hk.mm7lab.watchcat

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** Reads the watch's step counter (steps since the watch last restarted). */
object Steps {
    fun allowed(ctx: Context) =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    /** The step count now, or the last one known (-1 if none). Waits at most a couple of seconds. */
    suspend fun read(ctx: Context): Long {
        if (!allowed(ctx)) return -1L
        val sm = ctx.getSystemService(SensorManager::class.java) ?: return -1L
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return -1L
        val n = withTimeoutOrNull(2500L) {
            suspendCancellableCoroutine { cont ->
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(e: SensorEvent) {
                        sm.unregisterListener(this)
                        if (cont.isActive) cont.resume(e.values[0].toLong())
                    }
                    override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
                }
                sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                cont.invokeOnCancellation { sm.unregisterListener(listener) }
            }
        }
        if (n != null) Store.saveSteps(ctx, n)
        return n ?: Store.lastSteps(ctx)
    }
}
