// Force-download a remote file by fetching it as a blob and triggering
// a synthetic anchor click. Works around browsers that ignore the
// `download` attribute on cross-origin URLs (Supabase storage, etc).
export async function downloadFile(url: string, fileName?: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName || guessName(url);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
  } catch {
    // Fallback: open in new tab so user can save manually
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function guessName(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
}
