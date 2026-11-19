package eu.senda.field;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import java.util.List;

/**
 * Pantalla en el coche: estado del trayecto y avisos por delante. Si no hay avisos, lo dice: no se muestra
 * nada inventado. «Empezar» y «Parar» usan la misma máquina de estados que el móvil (DriveAutostart).
 */
public final class DriveCarScreen extends Screen {
    public DriveCarScreen(@NonNull CarContext ctx) { super(ctx); }

    @NonNull @Override @SuppressWarnings("deprecation")
    public Template onGetTemplate() {
        DriveController c = DriveController.get(getCarContext());
        ItemList.Builder list = new ItemList.Builder();
        String state = c.state().name() + (c.sessionActive() ? " · en ruta" : "");
        list.addItem(new Row.Builder().setTitle("SENDA Drive").addText("Estado: " + state).build());
        List<String> hazards = DriveHazards.current();
        if (hazards.isEmpty()) list.addItem(new Row.Builder().setTitle("Sin avisos recibidos por delante").addText("Hoy los avisos por voz salen de la app del móvil abierta").build());
        else for (String h : hazards) list.addItem(new Row.Builder().setTitle(h).build());
        list.addItem(new Row.Builder().setTitle("Empezar ahora").setOnClickListener(() -> { c.event("USER_START"); invalidate(); }).build());
        list.addItem(new Row.Builder().setTitle("Parar ahora").setOnClickListener(() -> { c.event("USER_STOP"); invalidate(); }).build());
        return new ListTemplate.Builder().setTitle("SENDA").setHeaderAction(Action.APP_ICON).setSingleList(list.build()).build();
    }
}
