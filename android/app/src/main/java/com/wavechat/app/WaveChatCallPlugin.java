package com.wavechat.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;

@CapacitorPlugin(
    name = "WaveChatCall",
    permissions = @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = WaveChatCallPlugin.GALLERY_PERMISSION)
)
public class WaveChatCallPlugin extends Plugin {
    static final String GALLERY_PERMISSION = "gallery";

    @PluginMethod
    public void stopAlerts(PluginCall call) {
        String callId = call.getString("callId", null);
        CallAlertUtils.stopAllCallAlerts(getContext(), callId);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        String callId = call.getString("callId", null);
        CallAlertUtils.stopAllCallAlerts(getContext(), callId);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void configureAudio(PluginCall call) {
        CallAlertUtils.configureInCallAudio(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void resetAudio(PluginCall call) {
        CallAlertUtils.resetInCallAudio(getContext());
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        CallAlertUtils.setSpeakerphone(getContext(), on);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setBadge(PluginCall call) {
        int count = call.getInt("count", 0);
        BadgeUtils.setBadgeCount(getContext(), count);
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(GALLERY_PERMISSION) != PermissionState.GRANTED) {
            requestPermissionForAlias(GALLERY_PERMISSION, call, "saveImagePermissionCallback");
            return;
        }
        doSaveImageToGallery(call);
    }

    @PluginMethod
    public void saveMediaToGallery(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState(GALLERY_PERMISSION) != PermissionState.GRANTED) {
            requestPermissionForAlias(GALLERY_PERMISSION, call, "saveMediaPermissionCallback");
            return;
        }
        doSaveMediaToGallery(call);
    }

    @PermissionCallback
    private void saveImagePermissionCallback(PluginCall call) {
        if (getPermissionState(GALLERY_PERMISSION) == PermissionState.GRANTED) {
            doSaveImageToGallery(call);
        } else {
            call.reject("Permissão da galeria negada");
        }
    }

    @PermissionCallback
    private void saveMediaPermissionCallback(PluginCall call) {
        if (getPermissionState(GALLERY_PERMISSION) == PermissionState.GRANTED) {
            doSaveMediaToGallery(call);
        } else {
            call.reject("Permissão da galeria negada");
        }
    }

    private void doSaveImageToGallery(PluginCall call) {
        String dataUrl = call.getString("dataUrl", null);
        String fileName = call.getString("fileName", "wavechat-qr-convite.png");
        if (dataUrl == null || !dataUrl.startsWith("data:image/")) {
            call.reject("Imagem inválida");
            return;
        }

        try {
            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex < 0) {
                call.reject("Imagem inválida");
                return;
            }

            String mimeType = dataUrl.substring(5, dataUrl.indexOf(';'));
            byte[] imageBytes = Base64.decode(dataUrl.substring(commaIndex + 1), Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/WaveChat");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Não foi possível criar a imagem na galeria");
                return;
            }

            try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                if (outputStream == null) {
                    call.reject("Não foi possível abrir a galeria");
                    return;
                }
                outputStream.write(imageBytes);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues doneValues = new ContentValues();
                doneValues.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, doneValues, null, null);
            }

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Falha ao salvar na galeria", e);
        }
    }

    @PluginMethod
    public void getRingtone(PluginCall call) {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(CallAlertUtils.PREFS_NAME, Context.MODE_PRIVATE);
        String uri = prefs.getString(CallAlertUtils.PREF_RINGTONE_URI, null);
        String name = prefs.getString(CallAlertUtils.PREF_RINGTONE_NAME, null);
        JSObject result = new JSObject();
        result.put("uri", uri);
        result.put("name", name);
        result.put("isDefault", uri == null);
        call.resolve(result);
    }

    @PluginMethod
    public void clearRingtone(PluginCall call) {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(CallAlertUtils.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .remove(CallAlertUtils.PREF_RINGTONE_URI)
            .remove(CallAlertUtils.PREF_RINGTONE_NAME)
            .apply();
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void pickRingtone(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "audio/*" });
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "ringtonePickerResult");
    }

    @ActivityCallback
    private void ringtonePickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject r = new JSObject();
            r.put("ok", false);
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            JSObject r = new JSObject();
            r.put("ok", false);
            call.resolve(r);
            return;
        }
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {}
        String displayName = queryDisplayName(uri);
        SharedPreferences prefs = getContext()
            .getSharedPreferences(CallAlertUtils.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(CallAlertUtils.PREF_RINGTONE_URI, uri.toString())
            .putString(CallAlertUtils.PREF_RINGTONE_NAME, displayName)
            .apply();
        JSObject r = new JSObject();
        r.put("ok", true);
        r.put("uri", uri.toString());
        r.put("name", displayName);
        call.resolve(r);
    }

    @PluginMethod
    public void previewRingtone(PluginCall call) {
        CallAlertUtils.previewRingtone(getContext());
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void stopPreviewRingtone(PluginCall call) {
        CallAlertUtils.stopPreviewRingtone();
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(
                uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String name = c.getString(idx);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {}
        return "Toque personalizado";
    }
}
