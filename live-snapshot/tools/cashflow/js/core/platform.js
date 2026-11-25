/* =============================================================================
   core/platform.js — environment adapters.
   saveFile(): in a normal browser a file is downloaded with an <a download>
   link. Inside a claude.ai hosted page the "downloads" capability is used
   instead, because direct downloads are blocked there.
   ============================================================================= */
(function(){
let dl = null, probed = false;
async function downloadsApi(){
  if (probed) return dl;
  probed = true;
  try { if (window.claude && typeof window.claude.use === "function") dl = await window.claude.use("downloads"); }
  catch(e){ dl = null; }
  return dl;
}
BM.saveFile = async function(filename, blob){
  const api = await downloadsApi();
  if (api){
    try { await api.save({filename, data: blob}); return true; }
    catch(e){ BM.toast(L("The download was not completed.","لم يكتمل التنزيل.")); return false; }
  }
  try {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    return true;
  } catch(e){ BM.toast(L("This browser blocked the download.","المتصفح منع التنزيل.")); return false; }
};
BM.xlsxReady = function(){
  if (typeof XLSX === "undefined"){ BM.toast(L("The Excel library did not load. Check your internet connection and reload.","لم يتم تحميل مكتبة Excel. تحقق من الاتصال وأعد التحميل.")); return false; }
  return true;
};
})();
