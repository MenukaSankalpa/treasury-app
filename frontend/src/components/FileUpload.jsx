import { useRef, useState } from "react";
import { API_URL } from "../config";

export default function FileUpload({files, setFiles, accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg", label="Attachments"}) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const onPick = async (e) => {
    const picked = Array.from(e.target.files || []);
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of picked) {
        const formData = new FormData();
        formData.append("file", file);
        const token = localStorage.getItem("treasury_token");
        const res = await fetch(`${API_URL}/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploaded.push(data);
      }
      setFiles([...(files||[]), ...uploaded]);
    } catch (err) {
      alert("File upload failed: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const remove = (i) => setFiles(files.filter((_,idx)=>idx!==i));

  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4,display:"block",fontWeight:500}}>{label}</label>
      <input ref={inputRef} type="file" multiple accept={accept} onChange={onPick} style={{display:"none"}} />
      <button type="button" onClick={()=>inputRef.current.click()} disabled={uploading} style={{padding:"7px 14px",borderRadius:8,border:"0.5px dashed var(--color-border-secondary)",background:"var(--color-background-secondary)",cursor:"pointer",fontSize:13}}>
        {uploading ? "Uploading…" : "+ Attach files (PDF, Word, Excel, Image)"}
      </button>
      {files?.length > 0 && (
        <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
          {files.map((f,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--color-background-secondary)",borderRadius:8,padding:"6px 10px",fontSize:12}}>
              <a href={f.url} target="_blank" rel="noreferrer" style={{color:"var(--color-text-info)",textDecoration:"none"}}>{f.name}</a>
              <button type="button" onClick={()=>remove(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-danger)",fontSize:13}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}