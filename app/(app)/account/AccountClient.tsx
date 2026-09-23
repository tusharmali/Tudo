"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeMyPasswordAction, resetPasswordAction, updateMyNameAction, updateMyAvatarAction } from "@/app/actions/account";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { toast } from "@/components/Toaster";

type Lite = { id: string; name: string; email: string };
type Me = { id: string; name: string; color: string; avatar: string; role: string };

/** Read a file straight to a data URL, no re-encoding (keeps GIF animation). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

/** Downscale a picked image to a small square-ish JPEG data URL, client-side. */
function resizeImage(file: File, max = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Couldn't process the image."));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a valid image."));
    };
    img.src = url;
  });
}

function ProfileCard({ me }: { me: Me }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me.name);
  const [preview, setPreview] = useState<string | null>(null); // optimistic photo
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  async function saveName() {
    if (name.trim() === me.name) return;
    setSavingName(true);
    const r = await updateMyNameAction({ name });
    if (r.ok) {
      toast(r.message || "Saved");
      router.refresh();
    } else toast(r.error || "Error");
    setSavingName(false);
  }

  async function pickPhoto(file: File) {
    setSavingPhoto(true);
    try {
      // GIFs are uploaded as-is so they keep animating; everything else is
      // downscaled to a small JPEG. GIFs can't be resized in-canvas without
      // flattening, so we cap the file size instead.
      let dataUrl: string;
      if (file.type === "image/gif") {
        if (file.size > 2_000_000) throw new Error("GIF is too large — keep it under 2 MB.");
        dataUrl = await fileToDataUrl(file);
      } else {
        dataUrl = await resizeImage(file);
      }
      setPreview(dataUrl);
      const r = await updateMyAvatarAction({ dataUrl });
      if (r.ok) {
        toast(r.message || "Saved");
        router.refresh();
      } else {
        setPreview(null);
        toast(r.error || "Error");
      }
    } catch (e) {
      setPreview(null);
      toast((e as Error).message || "Error");
    }
    setSavingPhoto(false);
  }

  async function removePhoto() {
    setSavingPhoto(true);
    const r = await updateMyAvatarAction({ dataUrl: "" });
    if (r.ok) {
      setPreview(null);
      toast(r.message || "Removed");
      router.refresh();
    } else toast(r.error || "Error");
    setSavingPhoto(false);
  }

  const src = preview || avatarSrc(me);

  return (
    <div className="card pad" style={{ gridColumn: "1 / -1" }}>
      <h3 className="sec" style={{ marginBottom: 14 }}>Your profile</h3>
      <div className="row" style={{ gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={me.name} color={me.color} src={src} size="xl" />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickPhoto(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()} disabled={savingPhoto}>
            {savingPhoto ? "Uploading…" : src ? "Change photo" : "Upload photo"}
          </button>
          {src && (
            <button className="btn btn-ghost" type="button" onClick={removePhoto} disabled={savingPhoto}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, maxWidth: 420 }}>
        <label className="lbl">Display name</label>
        <div className="row" style={{ gap: 8 }}>
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" type="button" onClick={saveName} disabled={savingName || name.trim() === me.name || name.trim().length < 2}>
            {savingName ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="muted tiny" style={{ margin: "8px 0 0" }}>
          {me.role} · shown across Tudo. Photo can be PNG, JPG, WebP or an animated GIF (≤ 2 MB).
        </p>
      </div>
    </div>
  );
}

export default function AccountClient({ me, isAdmin, users }: { me: Me; isAdmin: boolean; users: Lite[] }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [busy, setBusy] = useState(false);

  const [uid, setUid] = useState(users[0]?.id || "");
  const [rpw, setRpw] = useState("");
  const [busyR, setBusyR] = useState(false);

  async function change() {
    if (nw.length < 6) {
      toast("New password must be at least 6 characters");
      return;
    }
    if (nw !== cf) {
      toast("New passwords don't match");
      return;
    }
    setBusy(true);
    const r = await changeMyPasswordAction({ current: cur, next: nw });
    if (r.ok) {
      toast(r.message || "Updated");
      setCur("");
      setNw("");
      setCf("");
    } else toast(r.error || "Error");
    setBusy(false);
  }

  async function reset() {
    if (rpw.length < 6) {
      toast("Password must be at least 6 characters");
      return;
    }
    setBusyR(true);
    const r = await resetPasswordAction({ userId: uid, next: rpw });
    if (r.ok) {
      toast(r.message || "Reset");
      setRpw("");
    } else toast(r.error || "Error");
    setBusyR(false);
  }

  return (
    <div className="grid g-2" style={{ alignItems: "start" }}>
      <ProfileCard me={me} />

      <div className="card pad">
        <h3 className="sec" style={{ marginBottom: 4 }}>
          Change your password
        </h3>
        <p className="muted tiny" style={{ margin: "0 0 14px" }}>
          Signed in as {me.name}.
        </p>
        <label className="lbl">Current password</label>
        <input className="inp" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" style={{ marginBottom: 12 }} />
        <label className="lbl">New password</label>
        <input className="inp" type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" style={{ marginBottom: 12 }} />
        <label className="lbl">Confirm new password</label>
        <input className="inp" type="password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" style={{ marginBottom: 14 }} />
        <button className="btn btn-primary btn-block" onClick={change} disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>

      {isAdmin && (
        <div className="card pad">
          <div className="between" style={{ marginBottom: 4 }}>
            <h3 className="sec">Reset a teammate&apos;s password</h3>
            <span className="pill p-peri">Super Admin</span>
          </div>
          <p className="muted tiny" style={{ margin: "0 0 14px" }}>
            Use this when someone forgets theirs — then share the new password with them directly.
          </p>
          <label className="lbl">Teammate</label>
          <select className="inp" value={uid} onChange={(e) => setUid(e.target.value)} style={{ marginBottom: 12 }}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <label className="lbl">New password</label>
          <input className="inp" type="text" value={rpw} onChange={(e) => setRpw(e.target.value)} placeholder="Set a temporary password" style={{ marginBottom: 14 }} />
          <button className="btn btn-primary btn-block" onClick={reset} disabled={busyR}>
            {busyR ? "Resetting…" : "Reset password"}
          </button>
        </div>
      )}
    </div>
  );
}
