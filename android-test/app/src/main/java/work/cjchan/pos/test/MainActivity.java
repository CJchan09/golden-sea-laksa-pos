package work.cjchan.pos.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.webkit.*;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** The save bridge is available only to the bundled app's HTTPS origin. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String BACKUP = "application/vnd.cjpos.backup+json";
    private static final String MENU = "application/vnd.cjpos.menu+json";
    private static final String ORDER = "application/vnd.cjpos.order+json";
    private static final int PICK_FILE = 10, SAVE_FILE = 11, PICK_FOLDER = 12;
    private static final long MAX_BYTES = 256L * 1024 * 1024;
    private static final long MAX_MENU_BYTES = 10L * 1024 * 1024;
    private static final long MAX_ORDER_BYTES = 256L * 1024;
    private static final int MAX_RECEIPT_LINK_CHARS = 8000;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private SharedPreferences prefs;
    private Transfer transfer;
    private Pending pendingSave, pendingFolder;
    private volatile String language = "en";
    private volatile boolean destroyed;
    private volatile String pendingReceiptUrl;

    private static class Pending {
        final String id;
        final JavaScriptReplyProxy reply;
        final String since;
        Pending(String id, JavaScriptReplyProxy reply, String since) {this.id=id; this.reply=reply; this.since=since;}
    }
    private static class Transfer {
        String id, filename, mime, day, revision, shareText;
        long size, written;
        boolean automatic, share;
        File file;
        OutputStream out;
    }
    private static class SaveException extends Exception {
        final String code;
        SaveException(String code) {super(code); this.code=code;}
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs=getSharedPreferences("cjpos-export",MODE_PRIVATE);
        language=prefs.getString("language","en");
        getWindow().setStatusBarColor(Color.rgb(17,19,16));
        getWindow().setNavigationBarColor(Color.rgb(17,19,16));
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(17,19,16));
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                WebResourceResponse local=loader.shouldInterceptRequest(request.getUrl());
                if(local!=null) return local;
                if("appassets.androidplatform.net".equals(request.getUrl().getHost())) return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(isLocal(uri)) return false;
                if(request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW,uri));} catch(Exception ignored) {}
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=callback;
                boolean image=false;
                for(String accept:params.getAcceptTypes()) if(accept.startsWith("image/")) image=true;
                Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                // Backup extensions have no system-wide MIME mapping, so validate them in the app.
                pick.setType(image ? "image/*" : "*/*");
                try {startActivityForResult(pick,PICK_FILE);} catch(Exception error) {fileCallback.onReceiveValue(null); fileCallback=null;}
                return true;
            }
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton(label("OK","确定","OK"),(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton(label("Confirm","确认","Sahkan"),(d,w)->result.confirm()).setNegativeButton(label("Cancel","取消","Batal"),(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"CJNative",Collections.singleton(ORIGIN),(view,message,source,isMainFrame,reply)-> {
                if(!isMainFrame || !ORIGIN.equals(source.toString())) return;
                String raw=message.getData();
                if(raw==null || raw.length()>180_000) return;
                io.execute(()->handle(raw,reply));
            });
        }
        String receipt=receiptUrl(getIntent());
        web.loadUrl(receipt==null ? ORIGIN+"/index.html" : receipt);
    }

    /** External intents may select a local route, never a network page or script. */
    private static String receiptUrl(Intent intent) {
        if(intent==null || !Intent.ACTION_VIEW.equals(intent.getAction())) return null;
        Uri uri=intent.getData();
        if(uri==null || uri.toString().length()>MAX_RECEIPT_LINK_CHARS || !"https".equals(uri.getScheme()) ||
            !"pos.cj-chan.work".equalsIgnoreCase(uri.getHost()) || (uri.getPort()!=-1 && uri.getPort()!=443) ||
            uri.getUserInfo()!=null || uri.getQuery()!=null ||
            !("/receive/".equals(uri.getPath()) || "/receive".equals(uri.getPath()))) return null;
        String payload=uri.getEncodedFragment();
        if(payload==null || payload.isEmpty() || !payload.matches("[A-Za-z0-9_-]+")) return null;
        return ORIGIN+"/index.html#/cashier/receive?payload="+Uri.encode(payload);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String receipt=receiptUrl(intent);
        if(receipt==null) return;
        setIntent(intent);
        pendingReceiptUrl=receipt;
        io.execute(this::drainReceipt);
    }

    private void drainReceipt() {
        if(destroyed || transfer!=null || pendingSave!=null || pendingFolder!=null || fileCallback!=null) return;
        String receipt=pendingReceiptUrl;
        pendingReceiptUrl=null;
        if(receipt!=null) runOnUiThread(()-> {if(!destroyed) web.loadUrl(receipt);});
    }

    private void handle(String raw,JavaScriptReplyProxy reply) {
        String id="";
        try {
            JSONObject data=new JSONObject(raw);
            id=data.getString("id");
            String requested=data.optString("language");
            if(Arrays.asList("en","zh","ms").contains(requested)) {language=requested; prefs.edit().putString("language",language).apply();}
            switch(data.getString("type")) {
                case "report-exists": respond(reply,id,new JSONObject().put("exists",reportExists(data.optString("uri")))); return;
                case "folder-status": respond(reply,id,folderStatus()); return;
                case "disable-folder":
                    prefs.edit().putBoolean("enabled",false).apply();
                    respond(reply,id,new JSONObject()); return;
                case "choose-folder":
                    if(pendingFolder!=null || pendingSave!=null || transfer!=null) throw new SaveException("BUSY");
                    String since=data.getString("since");
                    if(!since.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new SaveException("INVALID_REQUEST");
                    pendingFolder=new Pending(id,reply,since);
                    runOnUiThread(()-> {
                        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                        try {startActivityForResult(intent,PICK_FOLDER);} catch(Exception error) {io.execute(()->finishFolder(null,0));}
                    }); return;
                case "file-begin": begin(data); respond(reply,id,new JSONObject()); return;
                case "file-chunk": append(data); respond(reply,id,new JSONObject()); return;
                case "file-abort":
                    if(transfer!=null && transfer.id.equals(data.optString("transfer")) && pendingSave==null) discardTransfer();
                    respond(reply,id,new JSONObject()); drainReceipt(); return;
                case "file-finish":
                    requireTransfer(data);
                    if(pendingSave!=null) throw new SaveException("BUSY");
                    if(transfer.written!=transfer.size) throw new SaveException("INVALID_REQUEST");
                    transfer.out.close(); transfer.out=null;
                    if(transfer.share) {
                        shareTransferredFile(reply,id);
                    } else if(transfer.automatic) {
                        String uri=saveAutomatic();
                        discardTransfer();
                        respond(reply,id,new JSONObject().put("uri",uri));
                        drainReceipt();
                    } else {
                        pendingSave=new Pending(id,reply,"");
                        final String mime=transfer.mime, filename=transfer.filename;
                        runOnUiThread(()-> {
                            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType(mime); intent.putExtra(Intent.EXTRA_TITLE,filename);
                            try {startActivityForResult(intent,SAVE_FILE);} catch(Exception error) {io.execute(()->finishManual(null));}
                        });
                    }
                    return;
                default: throw new SaveException("INVALID_REQUEST");
            }
        } catch(Exception error) {
            fail(reply,id,error);
        }
    }

    private void begin(JSONObject data) throws Exception {
        if(transfer!=null || pendingSave!=null || pendingFolder!=null) throw new SaveException("BUSY");
        long size=data.getLong("size");
        if(size<0 || size>MAX_BYTES) throw new SaveException("TOO_LARGE");
        String mime=data.getString("mime");
        if(!XLSX.equals(mime) && !BACKUP.equals(mime) && !MENU.equals(mime) && !ORDER.equals(mime)) throw new SaveException("INVALID_REQUEST");
        if((MENU.equals(mime) && size>MAX_MENU_BYTES) || (ORDER.equals(mime) && size>MAX_ORDER_BYTES)) throw new SaveException("TOO_LARGE");
        String extension=XLSX.equals(mime)?".xlsx":BACKUP.equals(mime)?".cjpos":MENU.equals(mime)?".cjmenu":".cjorder";
        String filename=data.getString("filename").replaceAll("[^a-zA-Z0-9._-]","_");
        if(filename.length()>140) filename=filename.substring(0,130)+extension;
        if(!filename.endsWith(extension)) filename+=extension;
        Transfer next=new Transfer();
        next.id=data.getString("transfer"); next.filename=filename; next.mime=mime; next.size=size;
        next.automatic=data.optBoolean("automatic");
        next.share=data.optBoolean("share");
        next.shareText=data.optString("text");
        if(next.share && (next.automatic || (!MENU.equals(mime) && !ORDER.equals(mime)) || next.shareText.length()>65536)) throw new SaveException("INVALID_REQUEST");
        next.day=data.optString("day"); next.revision=data.optString("revision");
        if(next.automatic && (!XLSX.equals(mime) || !next.day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || !next.revision.matches("[a-f0-9]{64}"))) throw new SaveException("INVALID_REQUEST");
        if(next.automatic) {
            if(!prefs.getBoolean("enabled",true)) throw new SaveException("NO_FOLDER");
            requireFolder();
        }
        next.file=File.createTempFile("cjpos-export-",".tmp",getCacheDir());
        next.out=new BufferedOutputStream(new FileOutputStream(next.file));
        transfer=next;
    }

    private void shareTransferredFile(JavaScriptReplyProxy reply,String id) throws Exception {
        // This directory is the FileProvider's only readable root. Do not expose app data.
        File directory=new File(getCacheDir(),"shares/"+UUID.randomUUID().toString());
        if(!directory.mkdirs()) throw new SaveException("SAVE_FAILED");
        File file=new File(directory,transfer.filename);
        if(!file.getCanonicalPath().startsWith(directory.getCanonicalPath()+File.separator)) throw new SaveException("INVALID_REQUEST");
        try(InputStream input=new BufferedInputStream(new FileInputStream(transfer.file));
            OutputStream output=new BufferedOutputStream(new FileOutputStream(file))) {
            byte[] buffer=new byte[64*1024]; int count;
            while((count=input.read(buffer))!=-1) output.write(buffer,0,count);
        }
        if(!MessageDigest.isEqual(digest(new FileInputStream(transfer.file)),digest(new FileInputStream(file)))) throw new SaveException("SAVE_FAILED");
        final Uri uri=FileProvider.getUriForFile(this,getPackageName()+".sharing",file);
        final String mime=transfer.mime, text=transfer.shareText;
        discardTransfer();
        runOnUiThread(()-> {
            try {
                Intent share=new Intent(Intent.ACTION_SEND);
                share.setType(mime);
                share.putExtra(Intent.EXTRA_STREAM,uri);
                if(!text.isEmpty()) share.putExtra(Intent.EXTRA_TEXT,text);
                share.setClipData(ClipData.newRawUri("CJ POS file",uri));
                share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser=Intent.createChooser(share,label("Share with…","分享至…","Kongsi dengan…"));
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(chooser);
                // The chooser opening says nothing about whether a recipient received the file.
                respond(reply,id,new JSONObject().put("sharesheetOpened",true));
            } catch(Exception error) {fail(reply,id,error);}
            io.execute(this::drainReceipt);
        });
        // The cache copy remains available for the chosen app to read asynchronously.
    }
    private void requireTransfer(JSONObject data) throws Exception {
        if(transfer==null || !transfer.id.equals(data.getString("transfer"))) throw new SaveException("INVALID_REQUEST");
    }
    private void append(JSONObject data) throws Exception {
        requireTransfer(data);
        if(transfer.out==null || transfer.written!=data.getLong("offset")) throw new SaveException("INVALID_REQUEST");
        byte[] bytes=Base64.decode(data.getString("base64"),Base64.NO_WRAP);
        if(bytes.length>98_304 || transfer.written+bytes.length>transfer.size) throw new SaveException("TOO_LARGE");
        transfer.out.write(bytes); transfer.written+=bytes.length;
    }
    private Uri requireFolder() throws Exception {
        return validateFolder(prefs.getString("folder",""));
    }
    private Uri validateFolder(String saved) throws Exception {
        if(saved.isEmpty()) throw new SaveException("NO_FOLDER");
        Uri tree=Uri.parse(saved);
        boolean allowed=false;
        for(UriPermission permission:getContentResolver().getPersistedUriPermissions()) {
            if(permission.getUri().equals(tree) && permission.isWritePermission() && permission.isReadPermission()) allowed=true;
        }
        if(!allowed) throw new SaveException("FOLDER_PERMISSION");
        Uri folder=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));
        try(Cursor cursor=getContentResolver().query(folder,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)) {
            if(cursor==null || !cursor.moveToFirst()) throw new SaveException("FOLDER_PERMISSION");
        } catch(SecurityException error) {throw new SaveException("FOLDER_PERMISSION");}
        return folder;
    }
    private JSONObject folderStatus() throws Exception {
        String saved=prefs.getString("folder","");
        if(saved.isEmpty()) return new JSONObject().put("enabled",false);
        if(!prefs.getBoolean("enabled",true)) return new JSONObject().put("enabled",false).put("key",saved).put("since",prefs.getString("since",""));
        Uri folder=requireFolder();
        String name=folder.toString();
        try(Cursor cursor=getContentResolver().query(folder,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)) {
            if(cursor!=null && cursor.moveToFirst()) name=cursor.getString(0);
        }
        return new JSONObject().put("enabled",true).put("folder",name).put("key",saved).put("since",prefs.getString("since",""));
    }
    private String saveAutomatic() throws Exception {
        Uri folder=requireFolder();
        String key="daily:"+prefs.getString("folder","")+":"+transfer.day;
        String oldRevision=prefs.getString(key+":revision","");
        String oldUri=prefs.getString(key+":uri","");
        if(transfer.revision.equals(oldRevision) && !oldUri.isEmpty()) {
            try(InputStream input=getContentResolver().openInputStream(Uri.parse(oldUri))) {
                if(input!=null) return oldUri; // Already acknowledged before a JS restart.
            } catch(Exception ignored) {}
        }
        // New immutable revision: never truncate the previous successful report.
        SimpleDateFormat format=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("Asia/Kuala_Lumpur"));
        String filename="CJ-POS-"+transfer.day+"-"+format.format(new Date())+"-"+transfer.revision.substring(0,12)+".xlsx";
        Uri created=DocumentsContract.createDocument(getContentResolver(),folder,XLSX,filename);
        if(created==null) throw new SaveException("SAVE_FAILED");
        writeAndVerify(created);
        prefs.edit().putString(key+":revision",transfer.revision).putString(key+":uri",created.toString()).commit();
        return created.toString();
    }
    private boolean reportExists(String value) {
        boolean registered=false;
        for(Map.Entry<String,?> entry:prefs.getAll().entrySet()) {
            if(entry.getKey().startsWith("daily:") && entry.getKey().endsWith(":uri") && value.equals(entry.getValue())) {registered=true; break;}
        }
        if(!registered || value.isEmpty()) return false;
        try(InputStream input=getContentResolver().openInputStream(Uri.parse(value))) {return input!=null && input.read()!=-1;}
        catch(Exception error) {return false;}
    }
    private void writeAndVerify(Uri destination) throws Exception {
        try(InputStream input=new BufferedInputStream(new FileInputStream(transfer.file));
            OutputStream output=getContentResolver().openOutputStream(destination,"wt")) {
            if(output==null) throw new SaveException("SAVE_FAILED");
            byte[] buffer=new byte[64*1024]; int count;
            while((count=input.read(buffer))!=-1) output.write(buffer,0,count);
            output.flush();
        }
        // A complete read-back must match before the UI can say saved.
        byte[] expected=digest(new FileInputStream(transfer.file));
        InputStream check=getContentResolver().openInputStream(destination);
        if(check==null || !MessageDigest.isEqual(expected,digest(check))) throw new SaveException("SAVE_FAILED");
    }
    private byte[] digest(InputStream input) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream stream=input) {byte[] buffer=new byte[64*1024]; int count; while((count=stream.read(buffer))!=-1) digest.update(buffer,0,count);}
        return digest.digest();
    }
    private void finishManual(Uri uri) {
        Pending request=pendingSave; pendingSave=null;
        if(request==null) return;
        try {
            if(uri==null) throw new SaveException("CANCELLED");
            if(transfer==null) throw new SaveException("SAVE_FAILED");
            writeAndVerify(uri);
            respond(request.reply,request.id,new JSONObject().put("uri",uri.toString()));
        } catch(Exception error) {fail(request.reply,request.id,error);}
        finally {discardTransfer(); drainReceipt();}
    }
    private void finishFolder(Uri tree,int flags) {
        Pending request=pendingFolder; pendingFolder=null;
        if(request==null) return;
        try {
            if(tree==null) throw new SaveException("CANCELLED");
            int grant=flags & (Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContentResolver().takePersistableUriPermission(tree,grant);
            validateFolder(tree.toString());
            String previous=prefs.getString("folder","");
            String since=previous.equals(tree.toString())?prefs.getString("since",request.since):request.since;
            prefs.edit().putString("folder",tree.toString()).putString("since",since).putBoolean("enabled",true).commit();
            respond(request.reply,request.id,folderStatus());
        } catch(Exception error) {fail(request.reply,request.id,error);}
        finally {drainReceipt();}
    }
    private void discardTransfer() {
        if(transfer==null) return;
        try {if(transfer.out!=null) transfer.out.close();} catch(Exception ignored) {}
        if(transfer.file!=null) transfer.file.delete(); // App-owned temporary staging file only.
        transfer=null;
    }
    private void respond(JavaScriptReplyProxy reply,String id,JSONObject data) {
        try {data.put("id",id).put("ok",true); post(reply,data.toString());} catch(Exception ignored) {}
    }
    private void fail(JavaScriptReplyProxy reply,String id,Exception error) {
        String code=error instanceof SaveException?((SaveException)error).code:error instanceof SecurityException?"FOLDER_PERMISSION":"SAVE_FAILED";
        try {post(reply,new JSONObject().put("id",id).put("ok",false).put("code",code).toString());} catch(Exception ignored) {}
    }
    private void post(JavaScriptReplyProxy reply,String message) {
        runOnUiThread(()-> {try {if(!destroyed) reply.postMessage(message);} catch(Exception ignored) {}});
    }
    private String label(String en,String zh,String ms) {return "zh".equals(language)?zh:"ms".equals(language)?ms:en;}
    private static boolean isLocal(Uri uri) {return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPort()==-1;}

    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        Uri uri=result==RESULT_OK&&data!=null?data.getData():null;
        if(request==PICK_FILE && fileCallback!=null) {fileCallback.onReceiveValue(uri==null?null:new Uri[]{uri}); fileCallback=null; io.execute(this::drainReceipt);}
        if(request==SAVE_FILE) io.execute(()->finishManual(uri));
        if(request==PICK_FOLDER) {int flags=data==null?0:data.getFlags(); io.execute(()->finishFolder(uri,flags));}
    }
    @Override protected void onResume() {
        super.onResume();
        if(web!=null) web.evaluateJavascript("window.dispatchEvent(new Event('cjpos-native-resume'))",null);
    }
    @Override public void onBackPressed() {
        if(web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this).setMessage(label("Exit CJ POS? Saved records stay on this device.","退出 CJ POS？本机已保存的资料会保留。","Keluar CJ POS? Rekod tersimpan kekal di peranti ini.")).setPositiveButton(label("Exit","退出","Keluar"),(d,w)->finish()).setNegativeButton(label("Cancel","取消","Batal"),null).show();
    }
    @Override protected void onDestroy() {
        destroyed=true;
        if(fileCallback!=null) fileCallback.onReceiveValue(null);
        io.execute(this::discardTransfer);
        io.shutdown();
        web.destroy(); super.onDestroy();
    }
}
