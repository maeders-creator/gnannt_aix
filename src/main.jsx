
import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import{Boxes,LogOut,Plus,RefreshCw,ShoppingCart,Factory,ClipboardList,Search,Database,ShieldCheck,Wrench,X,Save,ChevronRight,UploadCloud,WifiOff,CloudUpload,Layers,Activity}from'lucide-react';
import'./style.css';

const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabase=Boolean(supabaseUrl&&supabaseAnonKey&&!supabaseUrl.includes('YOUR-PROJECT')&&!supabaseUrl.includes('aBcDe'));
const supabase=hasSupabase?createClient(supabaseUrl,supabaseAnonKey):null;
const QUEUE_KEY='stockpilot_offline_queue_v5_8';

function fmtEuro(v){return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0))}
function parseQty(v){if(v===null||v===undefined)return 0;const n=String(v).replace(',','.').match(/-?\d+(\.\d+)?/);return n?Number(n[0]):0}
function isCritical(p){const q=parseQty(p.quantity),min=parseQty(p.min_stock);return min>0&&q<min}
function loadQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch{return[]}}
function saveQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}
function tempId(){return 'offline_'+Date.now()+'_'+Math.random().toString(36).slice(2)}

const emptyPart={machine_id:'',station:'',designation:'',oem_article_number:'',third_party_supplier_number:'',location:'',quantity:'0',manufacturer:'',material_cost:'',min_stock:'',notes:''};
const emptyMachine={machine_name:'',machine_type:'',serial_no:'',operating_hours:'',status:'active',notes:''};

function MpsLogo({className=''}){return <div className={'mpsLogo '+className}><span className="mpsWhite">mp</span><span className="mpsSoft">s</span></div>}

function Login({onSession}){const[email,setEmail]=useState('admin@mps.local'),[password,setPassword]=useState('mps2026'),[msg,setMsg]=useState('');
async function signIn(e){e.preventDefault();setMsg('');if(!hasSupabase){setMsg('Supabase environment variables are missing.');return}const{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message);else onSession(data.session)}
return <div className="loginShell">
  <div className="loginHero">
    <div className="heroChip"><Activity size={16}/> Industrial spare parts intelligence</div>
    <h1>StockPilot AI<span>x</span> Pharma</h1>
    <p>Efficient inventory control for pharmaceutical packaging lines, machines and critical spare parts.</p>
    <div className="heroTiles">
      <div><b>Cloud</b><small>Supabase connected</small></div>
      <div><b>Offline</b><small>Queue sync</small></div>
      <div><b>MPS</b><small>Industrial standard</small></div>
    </div>
  </div>
  <form className="loginCard" onSubmit={signIn}>
    <MpsLogo className="loginLogo"/>
    <h2>Welcome back</h2>
    <p>Mäder Pharma Services GmbH</p>
    <label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)}/>
    <label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
    <button>Sign in</button>
    {msg&&<div className="error">{msg}</div>}
  </form>
</div>}

function Modal({title,children,onClose}){return <div className="modalBackdrop"><div className="modal"><div className="modalHead"><h3>{title}</h3><button className="iconBtn" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}

function PartsTable({parts,machineById,onEdit,onBook}){return <div className="tableWrap"><table><thead><tr><th>Machine</th><th>Station</th><th>Designation</th><th>OEM Article Number</th><th>3rd Party Supplier Number</th><th>Location</th><th>Qty</th><th>Min</th><th>Manufacturer</th><th>Cost</th><th>Action</th></tr></thead><tbody>{parts.map(p=><tr key={p.id} className={String(p.id).startsWith('offline_')?'offlineRow':''}><td>{machineById[p.machine_id]?.machine_name||'-'}</td><td>{p.station}</td><td><b>{p.designation}</b>{String(p.id).startsWith('offline_')&&<small className="offlineTag">offline pending</small>}</td><td>{p.oem_article_number}</td><td>{p.third_party_supplier_number}</td><td>{p.location}</td><td className={isCritical(p)?'textRed':''}><b>{p.quantity}</b></td><td>{p.min_stock}</td><td>{p.manufacturer}</td><td>{p.material_cost?fmtEuro(p.material_cost):''}</td><td className="actions"><button onClick={()=>onEdit(p)}>Edit</button><button onClick={()=>onBook(p,'out')}>Out</button><button onClick={()=>onBook(p,'in')}>In</button></td></tr>)}</tbody></table></div>}

function parseCsv(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 if(lines.length<2)return[];
 const parseLine=(line)=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++}else if(c==='"'){q=!q}else if((c===','||c===';')&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out.map(x=>x.trim())};
 const headers=parseLine(lines[0]);
 return lines.slice(1).map(l=>{const vals=parseLine(l),o={};headers.forEach((h,i)=>o[h]=vals[i]||'');return o});
}

function App(){const[session,setSession]=useState(null),[view,setView]=useState('dashboard'),[parts,setParts]=useState([]),[machines,setMachines]=useState([]),[transactions,setTransactions]=useState([]),[history,setHistory]=useState([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(false),[partModal,setPartModal]=useState(null),[machineModal,setMachineModal]=useState(null),[selectedMachineId,setSelectedMachineId]=useState(''),[machineFocus,setMachineFocus]=useState(false),[online,setOnline]=useState(navigator.onLine),[queue,setQueue]=useState(loadQueue()),[uploadStatus,setUploadStatus]=useState('');
useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
useEffect(()=>{if(!hasSupabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:listener}=supabase.auth.onAuthStateChange((_event,sess)=>setSession(sess));return()=>listener.subscription.unsubscribe()},[]);
useEffect(()=>{if(session)loadAll()},[session]);
useEffect(()=>{if(session&&online&&queue.length)syncOfflineQueue()},[session,online,queue.length]);

async function loadAll(){if(!hasSupabase)return;setLoading(true);const[m,p,t,h]=await Promise.all([supabase.from('machines_v5').select('*').order('machine_name'),supabase.from('parts_v5').select('*').order('designation').limit(30000),supabase.from('stock_transactions_v5').select('*').order('created_at',{ascending:false}).limit(200),supabase.from('machine_history_v5').select('*').order('created_at',{ascending:false}).limit(200)]);if(!m.error){setMachines(m.data||[]);if(!selectedMachineId&&(m.data||[]).length)setSelectedMachineId(m.data[0].id)}if(!p.error){const localAdds=queue.filter(q=>q.type==='addPart').map(q=>q.payload);setParts([...(p.data||[]),...localAdds])}if(!t.error)setTransactions(t.data||[]);if(!h.error)setHistory(h.data||[]);setLoading(false)}
async function signOut(){await supabase.auth.signOut();setSession(null)}
function updateQueue(next){setQueue(next);saveQueue(next)}
async function syncOfflineQueue(){if(!online||!queue.length)return;let remaining=[];for(const item of queue){if(item.type==='addPart'){const payload={...item.payload};delete payload.id;delete payload.offline_created_at;const{error}=await supabase.from('parts_v5').insert(payload);if(error){console.error(error);remaining.push(item)}}else remaining.push(item)}updateQueue(remaining);await loadAll()}

async function saveMachine(e){e.preventDefault();const d=machineModal.data;if(!d.machine_name)return alert('Machine name is required.');if(!online)return alert('Machine creation needs connection. Spare parts can be added offline after machines exist.');let res;if(d.id)res=await supabase.from('machines_v5').update({machine_name:d.machine_name,machine_type:d.machine_type,serial_no:d.serial_no,operating_hours:d.operating_hours,status:d.status,notes:d.notes}).eq('id',d.id);else res=await supabase.from('machines_v5').insert({machine_name:d.machine_name,machine_type:d.machine_type,serial_no:d.serial_no,operating_hours:d.operating_hours,status:d.status||'active',notes:d.notes});if(res.error)alert(res.error.message);setMachineModal(null);await loadAll()}
async function savePart(e){e.preventDefault();const d=partModal.data;if(!d.machine_id)return alert('Please select an existing machine first.');if(!d.designation)return alert('Designation is required.');const payload={machine_id:d.machine_id,station:d.station,designation:d.designation,oem_article_number:d.oem_article_number,third_party_supplier_number:d.third_party_supplier_number,location:d.location,quantity:d.quantity,manufacturer:d.manufacturer,material_cost:d.material_cost===''?null:Number(d.material_cost),min_stock:d.min_stock,notes:d.notes};if(!online||!hasSupabase){const offlinePayload={...payload,id:tempId(),offline_created_at:new Date().toISOString()};const next=[...queue,{type:'addPart',payload:offlinePayload}];updateQueue(next);setParts(prev=>[...prev,offlinePayload]);setPartModal(null);return alert('Saved offline. It will sync automatically when connection is back.')}let res;if(d.id&&!String(d.id).startsWith('offline_'))res=await supabase.from('parts_v5').update(payload).eq('id',d.id);else res=await supabase.from('parts_v5').insert(payload);if(res.error)alert(res.error.message);setPartModal(null);await loadAll()}
async function book(p,type){const qtyInput=window.prompt(type==='out'?'Withdrawal quantity?':'Goods receipt quantity?','1');const qty=Number(qtyInput||0);if(!qty||qty<=0)return;if(!online)return alert('Stock booking currently requires connection. Offline add-part is available.');const current=parseQty(p.quantity),newQty=type==='out'?current-qty:current+qty;const{error:e1}=await supabase.from('parts_v5').update({quantity:String(newQty)}).eq('id',p.id);const{error:e2}=await supabase.from('stock_transactions_v5').insert({part_id:p.id,type,quantity:qty,note:type==='out'?'Withdrawal':'Goods receipt'});if(e1||e2)alert(e1?.message||e2?.message);await loadAll()}
async function handleCsvUpload(e){
 const file=e.target.files?.[0];
 if(!file)return;
 setUploadStatus('Reading CSV file...');
 const text=await file.text();
 const rows=parseCsv(text);
 if(!rows.length){setUploadStatus('No rows found.');alert('No rows found.');return}
 if(!online){setUploadStatus('CSV upload needs connection.');alert('CSV upload needs connection. Single spare part add works offline.');return}
 let imported=0,skipped=0,errors=0;
 setUploadStatus(`Importing ${rows.length} rows...`);
 const localMachines=[...machines];
 for(const r of rows){
  const machineName=(r.machine_name||r.Machine||r.machine||'').trim();
  const designation=(r.designation||r.Designation||r.Beschreibung||r.description||'').trim();
  if(!machineName||!designation){skipped++;continue}
  let machine=localMachines.find(m=>m.machine_name===machineName);
  if(!machine){
    const {data,error}=await supabase.from('machines_v5').insert({machine_name:machineName,machine_type:r.machine_type||'Equipment',status:'active'}).select().single();
    if(error){console.error(error);errors++;continue}
    machine=data; localMachines.push(machine);
  }
  const payload={
    machine_id:machine.id,
    station:r.station||r.Station||'',
    designation,
    oem_article_number:r.oem_article_number||r['OEM Article Number']||r.OEM||'',
    third_party_supplier_number:r.third_party_supplier_number||r['3rd Party Supplier Number']||'',
    location:r.location||r.Location||r.Lagerort||'',
    quantity:r.quantity||r.Quantity||r.Menge||'',
    manufacturer:r.manufacturer||r.Manufacturer||r.Hersteller||'',
    material_cost:r.material_cost?Number(String(r.material_cost).replace(',','.')):null,
    min_stock:r.min_stock||r['Minimum Stock']||r.Mindestbestand||'',
    notes:r.notes||r.Notes||''
  };
  const exists=parts.find(p=>p.machine_id===machine.id&&String(p.designation||'')===payload.designation&&String(p.oem_article_number||'')===String(payload.oem_article_number||'')&&String(p.location||'')===String(payload.location||''));
  if(exists){skipped++;continue}
  const {error}=await supabase.from('parts_v5').insert(payload);
  if(error){console.error(error);errors++;continue}
  imported++;
  if(imported%25===0)setUploadStatus(`Imported ${imported} / ${rows.length}...`);
 }
 setUploadStatus(`Finished: imported ${imported}, skipped ${skipped}, errors ${errors}.`);
 await loadAll();
}

const machineById=useMemo(()=>Object.fromEntries(machines.map(m=>[m.id,m])),[machines]);const filtered=parts.filter(p=>[p.designation,p.oem_article_number,p.third_party_supplier_number,p.location,p.manufacturer,p.station,machineById[p.machine_id]?.machine_name].join(' ').toLowerCase().includes(search.toLowerCase()));const critical=parts.filter(isCritical);const value=parts.reduce((a,p)=>a+parseQty(p.quantity)*Number(p.material_cost||0),0);const reorder=critical;const selectedMachine=machines.find(m=>m.id===selectedMachineId);const selectedMachineParts=parts.filter(p=>p.machine_id===selectedMachineId);
if(!session)return <Login onSession={setSession}/>;
function chooseMachine(id){setSelectedMachineId(id);setMachineFocus(true)}
const nav=[['dashboard','Dashboard',Boxes],['parts','Spare Parts',Wrench],['machines','Machines',Factory],['reorder','Reorder List',ShoppingCart],['upload','Upload',UploadCloud],['transactions','Transactions',ClipboardList]];
return <div className="app"><aside><div className="brand"><MpsLogo/><div><b>StockPilot AIx</b><small>Pharma V5.8</small></div></div>{nav.map(([key,label,Icon])=><button key={key} className={view===key?'nav active':'nav'} onClick={()=>{setView(key);if(key!=='machines')setMachineFocus(false)}}><Icon size={17}/>{label}</button>)}<div className="connection">{online?<ShieldCheck size={16}/>:<WifiOff size={16}/>}<span>© Mäder Pharma Services<br/>{online?'MPS Database connected':'Offline mode'}{queue.length>0&&<><br/>{queue.length} pending sync</>}</span></div><button className="logout" onClick={signOut}><LogOut size={17}/>Sign out</button></aside><main><header><div><h2>{nav.find(n=>n[0]===view)?.[1]}</h2><p>Mäder Pharma Services GmbH · efficient master spare parts inventory</p></div><div className="searchBox"><Search size={18}/><input placeholder="Search designation, OEM no., 3rd-party no., location..." value={search} onChange={e=>setSearch(e.target.value)}/></div></header>{loading&&<div className="info">Loading data...</div>}{queue.length>0&&<div className="syncInfo"><CloudUpload size={18}/>{queue.length} offline item(s) waiting for synchronization.</div>}{parts.length===0&&<div className="warning"><Database size={18}/>No spare parts found. Import data first.</div>}
{view==='dashboard'&&<><div className="kpis"><div className="kpi"><span>Spare Parts</span><b>{parts.length.toLocaleString('de-DE')}</b></div><div className="kpi"><span>Machines</span><b>{machines.length}</b></div><div className="kpi"><span>Critical</span><b>{critical.length}</b></div><div className="kpi"><span>Stock Value</span><b>{fmtEuro(value)}</b></div></div><div className="grid"><section className="panel scrollPanel"><h3>Critical Spare Parts</h3>{critical.slice(0,30).map(p=><div className="item" key={p.id}><b>{p.designation}</b><br/>{p.oem_article_number||'-'} · {machineById[p.machine_id]?.machine_name||'-'} · Stock {p.quantity||0}/{p.min_stock||'-'}</div>)}</section><section className="panel scrollPanel"><h3>Machine Fleet</h3>{machines.slice(0,30).map(m=><button className="machineListItem" key={m.id} onClick={()=>{setView('machines');chooseMachine(m.id)}}><span><b>{m.machine_name}</b><br/>{m.machine_type||'-'} · SN {m.serial_no||'-'} · Hours {m.operating_hours||'-'}</span><ChevronRight size={18}/></button>)}</section></div></>}
{view==='parts'&&<section><div className="toolbar"><button onClick={()=>setPartModal({data:{...emptyPart,machine_id:machines[0]?.id||''}})}><Plus size={17}/>Add spare part</button><button className="secondary" onClick={loadAll}><RefreshCw size={17}/>Refresh</button></div><PartsTable parts={filtered} machineById={machineById} onEdit={p=>setPartModal({data:{...p,material_cost:p.material_cost||''}})} onBook={book}/></section>}
{view==='machines'&&<section className={machineFocus?'machineLayout focus':'machineLayout'}><div className="toolbar"><button onClick={()=>setMachineModal({data:{...emptyMachine}})}><Plus size={17}/>Add machine</button><button className="secondary" onClick={loadAll}><RefreshCw size={17}/>Refresh</button>{machineFocus&&<button className="secondary" onClick={()=>setMachineFocus(false)}>Machine list</button>}</div>{!machineFocus&&<div className="machineSelectPanel fullList"><h3>Select Machine</h3><div className="machineSelectList gridList">{machines.map(m=><button key={m.id} className="machinePick" onClick={()=>chooseMachine(m.id)}><b>{m.machine_name}</b><small>{m.machine_type||'-'} · {parts.filter(p=>p.machine_id===m.id).length} parts</small></button>)}</div></div>}{machineFocus&&selectedMachine&&<div className="machineDetailPanel fullDetail"><div className="detailHead"><div><h3>{selectedMachine.machine_name}</h3><p>{selectedMachine.machine_type||'-'} · SN {selectedMachine.serial_no||'-'} · Hours {selectedMachine.operating_hours||'-'}</p></div><button onClick={()=>setMachineModal({data:{...selectedMachine}})}>Edit machine</button></div><h3>Linked Spare Parts ({selectedMachineParts.length})</h3><PartsTable parts={selectedMachineParts} machineById={machineById} onEdit={p=>setPartModal({data:{...p,material_cost:p.material_cost||''}})} onBook={book}/></div>}</section>}
{view==='reorder'&&<div className="panel"><h3>Reorder List</h3><PartsTable parts={reorder} machineById={machineById} onEdit={p=>setPartModal({data:{...p,material_cost:p.material_cost||''}})} onBook={book}/></div>}
{view==='upload'&&<div className="panel uploadPanel"><h3>Upload Spare Parts CSV</h3><p>Upload a completed StockPilot CSV template. Existing parts are not deleted. Duplicates are skipped by machine + designation + OEM number + location.</p><div className="uploadBox"><UploadCloud size={34}/><label className="uploadLabel">Select and import CSV<input type="file" accept=".csv,text/csv" onChange={handleCsvUpload}/></label></div>{uploadStatus&&<div className="info">{uploadStatus}</div>}<div className="hint"><b>Required columns:</b> machine_name, station, designation, oem_article_number, third_party_supplier_number, location, quantity, manufacturer, material_cost, min_stock, notes</div></div>}
{view==='transactions'&&<div className="panel"><h3>Transaction History</h3><div className="tableWrap"><table><thead><tr><th>Date</th><th>Type</th><th>Part ID</th><th>Quantity</th><th>Note</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{new Date(t.created_at).toLocaleString('en-GB')}</td><td>{t.type}</td><td>{t.part_id}</td><td>{t.quantity}</td><td>{t.note}</td></tr>)}</tbody></table></div></div>}</main>
{machineModal&&<Modal title={machineModal.data.id?'Edit machine':'Add machine'} onClose={()=>setMachineModal(null)}><form onSubmit={saveMachine} className="formGrid"><label>Machine name<input value={machineModal.data.machine_name} onChange={e=>setMachineModal({data:{...machineModal.data,machine_name:e.target.value}})}/></label><label>Machine type<input value={machineModal.data.machine_type||''} onChange={e=>setMachineModal({data:{...machineModal.data,machine_type:e.target.value}})}/></label><label>Serial number<input value={machineModal.data.serial_no||''} onChange={e=>setMachineModal({data:{...machineModal.data,serial_no:e.target.value}})}/></label><label>Operating hours<input value={machineModal.data.operating_hours||''} onChange={e=>setMachineModal({data:{...machineModal.data,operating_hours:e.target.value}})}/></label><label>Status<input value={machineModal.data.status||'active'} onChange={e=>setMachineModal({data:{...machineModal.data,status:e.target.value}})}/></label><label className="full">Notes<input value={machineModal.data.notes||''} onChange={e=>setMachineModal({data:{...machineModal.data,notes:e.target.value}})}/></label><button className="full"><Save size={17}/>Save machine</button></form></Modal>}
{partModal&&<Modal title={partModal.data.id?'Edit spare part':'Add spare part'} onClose={()=>setPartModal(null)}><form onSubmit={savePart} className="formGrid"><label>Machine<select value={partModal.data.machine_id||''} onChange={e=>setPartModal({data:{...partModal.data,machine_id:e.target.value}})}><option value="">Select existing machine</option>{machines.map(m=><option key={m.id} value={m.id}>{m.machine_name}</option>)}</select></label><label>Station<input value={partModal.data.station||''} onChange={e=>setPartModal({data:{...partModal.data,station:e.target.value}})}/></label><label className="full">Designation<input value={partModal.data.designation||''} onChange={e=>setPartModal({data:{...partModal.data,designation:e.target.value}})}/></label><label>OEM Article Number<input value={partModal.data.oem_article_number||''} onChange={e=>setPartModal({data:{...partModal.data,oem_article_number:e.target.value}})}/></label><label>3rd Party Supplier Number<input value={partModal.data.third_party_supplier_number||''} onChange={e=>setPartModal({data:{...partModal.data,third_party_supplier_number:e.target.value}})}/></label><label>Location<input value={partModal.data.location||''} onChange={e=>setPartModal({data:{...partModal.data,location:e.target.value}})}/></label><label>Quantity<input value={partModal.data.quantity||''} onChange={e=>setPartModal({data:{...partModal.data,quantity:e.target.value}})}/></label><label>Minimum stock<input value={partModal.data.min_stock||''} onChange={e=>setPartModal({data:{...partModal.data,min_stock:e.target.value}})}/></label><label>Manufacturer<input value={partModal.data.manufacturer||''} onChange={e=>setPartModal({data:{...partModal.data,manufacturer:e.target.value}})}/></label><label>Material cost<input type="number" step="0.01" value={partModal.data.material_cost||''} onChange={e=>setPartModal({data:{...partModal.data,material_cost:e.target.value}})}/></label><label className="full">Notes<input value={partModal.data.notes||''} onChange={e=>setPartModal({data:{...partModal.data,notes:e.target.value}})}/></label><button className="full"><Save size={17}/>Save spare part</button></form></Modal>}</div>}
createRoot(document.getElementById('root')).render(<App/>);
