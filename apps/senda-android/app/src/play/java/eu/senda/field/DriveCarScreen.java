package eu.senda.field;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.List;

/**
 * Pantalla en el coche (Android Auto / Google integrado): estado del trayecto, métricas físicas
 * en tiempo real del Copiloto 5D (velocidad segura, distancia de parada SSD y reserva de adherencia)
 * y avisos activos por delante publicados desde el motor web vía `DriveHazards`.
 * Respeta el límite estricto de 6 filas de Android Auto en conducción y despacha `invalidate()` en
 * el hilo principal para ser seguro frente a invocaciones desde `JavascriptInterface`.
 */
public final class DriveCarScreen extends Screen {
    private static final int MAX_CAR_ALERT_ROWS = 3;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final DriveHazards.Listener listener = snap -> mainHandler.post(this::invalidate);

    public DriveCarScreen(@NonNull CarContext ctx) {
        super(ctx);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override public void onStart(@NonNull LifecycleOwner owner) { DriveHazards.addListener(listener); }
            @Override public void onStop(@NonNull LifecycleOwner owner) { DriveHazards.removeListener(listener); }
        });
    }

    @NonNull @Override @SuppressWarnings("deprecation")
    public Template onGetTemplate() {
        DriveController c = DriveController.get(getCarContext());
        ItemList.Builder list = new ItemList.Builder();
        String state = c.state().name() + (c.sessionActive() ? " · en ruta" : "");

        DriveHazards.Snapshot snap = DriveHazards.latestSnapshot();
        long now = System.currentTimeMillis();
        boolean fresh = snap != null && snap.isFresh(now, DriveHazards.DEFAULT_TTL_MS);

        if (fresh) {
            list.addItem(new Row.Builder()
                    .setTitle("SENDA Copiloto 5D · " + state)
                    .addText(snap.formatCompactSummary())
                    .build());

            if (snap.rows.isEmpty()) {
                list.addItem(new Row.Builder().setTitle("Tramo despejado por delante").addText("Sin alertas activas en el horizonte").build());
            } else {
                int count = Math.min(snap.rows.size(), MAX_CAR_ALERT_ROWS);
                for (int i = 0; i < count; i++) {
                    list.addItem(new Row.Builder().setTitle(snap.rows.get(i)).build());
                }
            }
        } else {
            list.addItem(new Row.Builder().setTitle("SENDA Drive").addText("Estado: " + state).build());
            List<String> hazards = DriveHazards.current();
            if (hazards.isEmpty()) {
                list.addItem(new Row.Builder()
                        .setTitle("Sin telemetría activa del Copiloto")
                        .addText("Abre Conducir o Copiloto 5D en el móvil para avisos en vivo")
                        .build());
            } else {
                int count = Math.min(hazards.size(), MAX_CAR_ALERT_ROWS);
                for (int i = 0; i < count; i++) list.addItem(new Row.Builder().setTitle(hazards.get(i)).build());
            }
        }

        list.addItem(new Row.Builder().setTitle("Empezar ahora").setOnClickListener(() -> { c.event("USER_START"); invalidate(); }).build());
        list.addItem(new Row.Builder().setTitle("Parar ahora").setOnClickListener(() -> { c.event("USER_STOP"); invalidate(); }).build());
        return new ListTemplate.Builder().setTitle("SENDA").setHeaderAction(Action.APP_ICON).setSingleList(list.build()).build();
    }
}
