import { useEffect, useState } from "react";

export type CleanerPropertyFormValues = {
  clientId: string;
  propertyName: string;
  propertyPhotoUrl: string;
  address: string;
  city: string;
  bedrooms: string;
  bathrooms: string;
  kitchens: string;
  floors: string;
  kingBeds: string;
  queenBeds: string;
  doubleBeds: string;
  twinBeds: string;
  bunkBeds: string;
  pyramidBunks: string;
  murphyBeds: string;
  sofaSleepers: string;
  cleaningFee: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  accessInstructions: string;
  wifiName: string;
  wifiPassword: string;
  parkingInstructions: string;
  trashInstructions: string;
  supplyLocations: string;
  privateCleanerNotes: string;
};

export type CleanerClientOption = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
};

type CleanerCreatePropertyPageProps = {
  onCancel: () => void;
  onSubmit: (values: CleanerPropertyFormValues) => Promise<void>;
  clients?: CleanerClientOption[];
  onCreateClient?: (values: {
    name: string;
    email: string;
    phone: string;
    preferredLanguage: string;
    notes: string;
  }) => Promise<CleanerClientOption>;
  isSaving?: boolean;
  initialValues?: CleanerPropertyFormValues;
  mode?: "create" | "edit";
  onDelete?: () => Promise<void>;
  propertyNameForDelete?: string;
};

const countOptions = ["0", "1", "2", "3", "4", "5", "6"];

const emptyValues: CleanerPropertyFormValues = {
  clientId: "",
  propertyName: "",
  propertyPhotoUrl: "",
  address: "",
  city: "",
  bedrooms: "0",
  bathrooms: "0",
  kitchens: "1",
  floors: "1",
  kingBeds: "0",
  queenBeds: "0",
  doubleBeds: "0",
  twinBeds: "0",
  bunkBeds: "0",
  pyramidBunks: "0",
  murphyBeds: "0",
  sofaSleepers: "0",
  cleaningFee: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  accessInstructions: "",
  wifiName: "",
  wifiPassword: "",
  parkingInstructions: "",
  trashInstructions: "",
  supplyLocations: "",
  privateCleanerNotes: "",
};

export default function CleanerCreatePropertyPage({
  onCancel,
  onSubmit,
  clients = [],
  onCreateClient,
  isSaving = false,
  initialValues: providedInitialValues,
  mode = "create",
  onDelete,
  propertyNameForDelete,
}: CleanerCreatePropertyPageProps) {
  const [form, setForm] = useState<CleanerPropertyFormValues>(providedInitialValues ?? emptyValues);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientError, setClientError] = useState("");
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", preferredLanguage: "English", notes: "" });

  useEffect(() => {
    setForm({ ...(providedInitialValues ?? emptyValues) });
    setError("");
  }, [mode, providedInitialValues]);

  function updateField(field: keyof CleanerPropertyFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleCancel() {
    if (mode === "create") setForm({ ...emptyValues });
    setError("");
    onCancel();
  }

  async function handleDelete() {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try { await onDelete(); } finally { setIsDeleting(false); }
  }

  async function handleCreateClient() {
    if (!onCreateClient || isSavingClient) return;
    if (!newClient.name.trim()) { setClientError("Add a client name before saving."); return; }
    if (!newClient.email.trim() && !newClient.phone.trim()) { setClientError("Add an email address or phone number."); return; }
    setIsSavingClient(true); setClientError("");
    try {
      const created = await onCreateClient({ ...newClient, name: newClient.name.trim(), email: newClient.email.trim(), phone: newClient.phone.trim(), notes: newClient.notes.trim() });
      setForm((current) => ({ ...current, clientId: created.id, ownerName: created.name, ownerEmail: created.email ?? "", ownerPhone: created.phone ?? "" }));
      setNewClient({ name: "", email: "", phone: "", preferredLanguage: "English", notes: "" });
      setShowNewClient(false);
    } catch (e) { setClientError(e instanceof Error ? e.message : "The client could not be created."); }
    finally { setIsSavingClient(false); }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.clientId) { setError("Select or create a client before continuing."); return; }
    if (!form.propertyName.trim()) { setError("Add a property name before continuing."); return; }
    if (!form.ownerName.trim()) { setError("Add the homeowner's name before continuing."); return; }
    if (!form.ownerEmail.trim() && !form.ownerPhone.trim()) { setError("Add at least one homeowner contact method: an email address or phone number."); return; }
    setError("");
    try { await onSubmit(form); if (mode === "create") setForm({ ...emptyValues }); }
    catch (e) { setError(e instanceof Error ? e.message : "The property could not be created."); }
  }

  const countSelect = (label: string, field: keyof CleanerPropertyFormValues) => (
    <label className="cleanerCreatePropertyField cleanerBedCountField">{label}
      <select value={form[field]} onChange={(e) => updateField(field, e.target.value)}>
        {countOptions.map((count) => <option key={count} value={count}>{count === "6" ? "6+" : count}</option>)}
      </select>
    </label>
  );

  return (
    <main className="cleanerCreatePropertyPage">
      <style>{`
        .cleanerCreatePropertyPage{padding-bottom:64px}.cleanerCreatePropertyForm{padding-bottom:32px}
        .cleanerCreatePropertyActions{margin-top:24px;padding:20px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;display:flex;justify-content:flex-end;gap:12px;box-shadow:0 10px 28px rgba(15,23,42,.06)}
        .cleanerCreatePropertyActions button{min-height:46px;padding:0 20px;border-radius:14px;font-weight:850}
        .cleanerPropertyDangerZone{margin-top:24px;padding:20px;border:1px solid #fecaca;border-radius:20px;background:#fff7f7;display:flex;justify-content:space-between;align-items:center;gap:18px}
        .cleanerPropertyDangerZone h3{margin:0 0 5px;color:#991b1b}.cleanerPropertyDangerZone p{margin:0;color:#7f1d1d}.cleanerPropertyDangerButton{min-height:44px;border:1px solid #ef4444;border-radius:14px;background:#fff;color:#b91c1c;padding:0 18px;font-weight:900;white-space:nowrap}
        .amrModalOverlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48)}
        .amrModalCard{width:min(620px,100%);max-height:90vh;overflow:auto;background:white;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
        .amrModalHeader{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.amrModalHeader h2{margin:2px 0 6px}.amrModalHeader p{margin:0;color:#64748b}.amrModalClose{border:0;width:36px;height:36px;border-radius:999px;background:#f1f5f9;font-weight:900;cursor:pointer}
        .cleanerClientCreateButton{margin-top:14px;min-height:44px;padding:0 18px;border-radius:14px}
        @media(max-width:700px){.cleanerCreatePropertyPage{padding-bottom:96px}.cleanerCreatePropertyActions{position:sticky;bottom:0;z-index:20;margin:18px -14px -16px;padding:12px 14px calc(12px + env(safe-area-inset-bottom));border-radius:18px 18px 0 0;background:rgba(255,255,255,.96);border-top:1px solid #e2e8f0;box-shadow:0 -10px 28px rgba(15,23,42,.08);backdrop-filter:blur(12px);display:grid;grid-template-columns:1fr 1fr}.cleanerCreatePropertyActions button{width:100%;padding:0 12px}.cleanerPropertyDangerZone{align-items:stretch;flex-direction:column}.cleanerPropertyDangerButton{width:100%}.amrModalOverlay{padding:16px 12px calc(96px + env(safe-area-inset-bottom))}.amrModalCard{width:100%;max-height:calc(100dvh - 128px)}}
      `}</style>
      <button className="cleanerPropertyDetailBackButton" type="button" onClick={handleCancel} disabled={isSaving}>{mode === "edit" ? "← Back to Property" : "← Back to Properties"}</button>
      <header className="cleanerCreatePropertyHeader"><div><p className="cleanerPropertiesEyebrow">{mode === "edit" ? "Property Settings" : "Property Onboarding"}</p><h1>{mode === "edit" ? "Edit Property" : "Create a Property"}</h1><p>{mode === "edit" ? "Update the client, home, cleaning workload, contact, and access details." : "Select the client, add the home and cleaning workload, then connect its calendar after saving."}</p></div><div className="cleanerCreatePropertyStepBadge"><strong>Cleaner setup</strong><span>Built around the work inside the home</span></div></header>
      <form className="cleanerCreatePropertyForm" onSubmit={handleSubmit} autoComplete="off">
        <section className="cleanerCreatePropertySection"><div className="cleanerCreatePropertySectionHeader"><div><p className="cleanerPropertyCardLabel">Client</p><h2>Who owns or manages this property?</h2></div><span>Required</span></div><div className="cleanerCreatePropertyFields"><label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Select client<select value={form.clientId} onChange={(e)=>{const id=e.target.value; const c=clients.find(x=>x.id===id); setForm(cur=>({...cur,clientId:id,ownerName:c?.name??cur.ownerName,ownerEmail:c?.email??cur.ownerEmail,ownerPhone:c?.phone??cur.ownerPhone}));}}><option value="">Select a client...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><button className="cleanerCreatePropertyCancelButton cleanerClientCreateButton" type="button" onClick={()=>{setClientError("");setShowNewClient(true)}}>+ Create New Client</button></section>

        <section className="cleanerCreatePropertySection"><div className="cleanerCreatePropertySectionHeader"><div><p className="cleanerPropertyCardLabel">Property</p><h2>Home information</h2></div><span>Required</span></div><div className="cleanerCreatePropertyFields">
          <label className="cleanerCreatePropertyField">Property name<input value={form.propertyName} onChange={e=>updateField("propertyName",e.target.value)} placeholder="Example: Gulf Front Retreat" autoFocus /></label>
          <label className="cleanerCreatePropertyField">Property photo URL<input value={form.propertyPhotoUrl} onChange={e=>updateField("propertyPhotoUrl",e.target.value)} placeholder="Optional image URL" /></label>
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Street address<input value={form.address} onChange={e=>updateField("address",e.target.value)} placeholder="123 Beach Avenue" /></label>
          <label className="cleanerCreatePropertyField">City / market<input value={form.city} onChange={e=>updateField("city",e.target.value)} placeholder="Destin, FL" /></label>
          <label className="cleanerCreatePropertyField">Standard cleaning fee<input type="number" min="0" step="0.01" value={form.cleaningFee} onChange={e=>updateField("cleaningFee",e.target.value)} placeholder="185" /></label>
        </div></section>

        <section className="cleanerCreatePropertySection"><div className="cleanerCreatePropertySectionHeader"><div><p className="cleanerPropertyCardLabel">Cleaning Workload</p><h2>Home setup</h2></div><span>Cleaner focused</span></div><div className="cleanerCreatePropertyFields cleanerHomeSetupFields">{countSelect("Bedrooms","bedrooms")}{countSelect("Bathrooms","bathrooms")}{countSelect("Kitchens","kitchens")}{countSelect("Floors","floors")}</div><div className="cleanerBeddingSection"><div><p className="cleanerPropertyCardLabel">Bedding</p><h3>Bed quantities</h3><p>Use these counts to remember which sheets and bedding are needed for each turnover.</p></div><div className="cleanerBeddingGrid">{countSelect("King","kingBeds")}{countSelect("Queen","queenBeds")}{countSelect("Double","doubleBeds")}{countSelect("Twin","twinBeds")}{countSelect("Bunk","bunkBeds")}{countSelect("Pyramid bunk","pyramidBunks")}{countSelect("Murphy bed","murphyBeds")}{countSelect("Sofa sleeper","sofaSleepers")}</div></div></section>

        <section className="cleanerCreatePropertySection cleanerOwnerContactSection"><div className="cleanerCreatePropertySectionHeader"><div><p className="cleanerPropertyCardLabel">Homeowner Contact</p><h2>Who should receive the calendar request?</h2></div><span>Required</span></div><div className="cleanerOwnerContactNotice"><span>📨</span><p>These fields are filled from the selected client and can be adjusted for this property.</p></div><div className="cleanerCreatePropertyFields">
          <label className="cleanerCreatePropertyField">Homeowner name<input value={form.ownerName} onChange={e=>updateField("ownerName",e.target.value)} placeholder="Homeowner name" /></label>
          <label className="cleanerCreatePropertyField">Homeowner email<input type="email" value={form.ownerEmail} onChange={e=>updateField("ownerEmail",e.target.value)} placeholder="owner@example.com" /></label>
          <label className="cleanerCreatePropertyField">Homeowner phone<input type="tel" value={form.ownerPhone} onChange={e=>updateField("ownerPhone",e.target.value)} placeholder="(555) 555-5555" /></label>
        </div><p className="cleanerCreatePropertyHelp">An email address or phone number is required.</p></section>

        <section className="cleanerCreatePropertySection"><div className="cleanerCreatePropertySectionHeader"><div><p className="cleanerPropertyCardLabel">Operations</p><h2>Cleaning and access details</h2></div><span>Private</span></div><div className="cleanerCreatePropertyFields">
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Door code / access instructions<textarea value={form.accessInstructions} onChange={e=>updateField("accessInstructions",e.target.value)} placeholder="Front door keypad, lockbox location, gate code..." /></label>
          <label className="cleanerCreatePropertyField">Wi-Fi name<input value={form.wifiName} onChange={e=>updateField("wifiName",e.target.value)} placeholder="Network name" autoComplete="off" /></label>
          <label className="cleanerCreatePropertyField">Wi-Fi password<input value={form.wifiPassword} onChange={e=>updateField("wifiPassword",e.target.value)} placeholder="Wi-Fi password" autoComplete="new-password" /></label>
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Parking instructions<textarea value={form.parkingInstructions} onChange={e=>updateField("parkingInstructions",e.target.value)} placeholder="Optional parking details or restrictions" /></label>
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Trash instructions<textarea value={form.trashInstructions} onChange={e=>updateField("trashInstructions",e.target.value)} placeholder="Trash day, bin location, disposal instructions" /></label>
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Supply locations<textarea value={form.supplyLocations} onChange={e=>updateField("supplyLocations",e.target.value)} placeholder="Linens, paper goods, cleaning supplies..." /></label>
          <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Private cleaner notes<textarea value={form.privateCleanerNotes} onChange={e=>updateField("privateCleanerNotes",e.target.value)} placeholder="Anything else the cleaner should remember" /></label>
        </div></section>

        {mode === "edit" && onDelete && <section className="cleanerPropertyDangerZone"><div><h3>Delete Property</h3><p>Permanently remove {propertyNameForDelete || "this property"} and its operational records.</p></div><button className="cleanerPropertyDangerButton" type="button" onClick={()=>void handleDelete()} disabled={isSaving||isDeleting}>{isDeleting?"Deleting...":"Delete Property"}</button></section>}
        {error && <p className="cleanerCreatePropertyError">{error}</p>}
        <div className="cleanerCreatePropertyActions"><button className="cleanerCreatePropertyCancelButton" type="button" onClick={handleCancel} disabled={isSaving}>Cancel</button><button className="cleanerCreatePropertySubmitButton" type="submit" disabled={isSaving}>{isSaving?(mode==="edit"?"Saving Changes...":"Saving Property..."):(mode==="edit"?"Save Changes":"Save Property")}</button></div>
      </form>

      {showNewClient && <div className="amrModalOverlay" role="presentation" onClick={()=>setShowNewClient(false)}><section className="amrModalCard" role="dialog" aria-modal="true" aria-label="Create new client" onClick={e=>e.stopPropagation()}><div className="amrModalHeader"><div><p className="cleanerPropertiesEyebrow">New client</p><h2>Create Client</h2><p>Add the homeowner or property-management contact.</p></div><button className="amrModalClose" type="button" onClick={()=>setShowNewClient(false)}>×</button></div><div className="cleanerCreatePropertyFields">
        <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Client name<input value={newClient.name} onChange={e=>setNewClient(c=>({...c,name:e.target.value}))} placeholder="Homeowner or company name" autoFocus /></label>
        <label className="cleanerCreatePropertyField">Email<input type="email" value={newClient.email} onChange={e=>setNewClient(c=>({...c,email:e.target.value}))} placeholder="client@example.com" /></label>
        <label className="cleanerCreatePropertyField">Phone<input type="tel" value={newClient.phone} onChange={e=>setNewClient(c=>({...c,phone:e.target.value}))} placeholder="(555) 555-5555" /></label>
        <label className="cleanerCreatePropertyField">Preferred language<select value={newClient.preferredLanguage} onChange={e=>setNewClient(c=>({...c,preferredLanguage:e.target.value}))}><option>English</option><option>Spanish</option><option>Portuguese</option><option>French</option></select></label>
        <label className="cleanerCreatePropertyField cleanerCreatePropertyFieldWide">Notes<textarea value={newClient.notes} onChange={e=>setNewClient(c=>({...c,notes:e.target.value}))} placeholder="Optional client notes" /></label>
      </div>{clientError&&<p className="cleanerCreatePropertyError">{clientError}</p>}<div className="cleanerCreatePropertyActions"><button className="cleanerCreatePropertyCancelButton" type="button" disabled={isSavingClient} onClick={()=>setShowNewClient(false)}>Cancel</button><button className="cleanerCreatePropertySubmitButton" type="button" disabled={isSavingClient} onClick={()=>void handleCreateClient()}>{isSavingClient?"Saving Client...":"Save Client"}</button></div></section></div>}
    </main>
  );
}
