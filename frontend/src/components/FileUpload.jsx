import { useRef } from "react";

export default function FileUpload({files, setFiles, accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg", label="Attachments"}) {
  const inputRef = useRef();

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    const withMeta = picked.map(f => ({ name:f.name, size:f.size, type:f.type, url:URL.createObjectURL(f) }));
    setFiles([...(files||[]), ...withMeta]);
    e.target.value = "";
  };

  const remove = (i) => setFiles(files.filter((_,idx)=>idx!==i));

  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:4,display:"block",fontWeight:500}}>{label}</label>
      <input ref={inputRef} type="file" multiple accept={accept} onChange={onPick} style={{display:"none"}} />
      <button type="button" onClick={()=>inputRef.current.click()} style={{padding:"7px 14px",borderRadius:8,border:"0.5px dashed var(--color-border-secondary)",background:"var(--color-background-secondary)",cursor:"pointer",fontSize:13}}>
        + Attach files (PDF, Word, Excel, Image)
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