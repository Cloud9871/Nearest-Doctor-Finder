/*
 * Nearest Doctor Finder — plain JavaScript edition
 * Reads live rows from the configured, publicly viewable Google Sheet.
 * No sample doctor records are bundled in this project.
 */
const SHEET_ID = "1cQuwXUh8VmU1lcROrO4vPsWDw0g2MQCjM_QaVrUkpHo";
const SHEET_GID = "0";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
const CACHE_MS = 5 * 60 * 1000;

const PINCODES = {
  "110005": [28.6519, 77.1909],
  "110008": [28.622, 77.13979],
  "110017": [28.53284, 77.22482],
  "110019": [28.54762, 77.2498],
  "110027": [28.64804, 77.12194],
  "110029": [28.56691, 77.20304],
  "110046": [28.5686, 77.2185],
  "110048": [28.54724, 77.23931],
  "110055": [28.64497, 77.21159],
  "110058": [28.6189, 77.087],
  "110065": [28.56381, 77.24995],
  "110070": [28.5352, 77.16036],
  "201301": [28.56738, 77.3732],
  "201316": [28.58339, 77.38917],
  "400053": [19.13645, 72.82552],
  "400066": [19.23411, 72.86678],
  "400071": [19.06742, 72.89891],
  "400080": [19.17006, 72.9516],
  "400086": [19.08771, 72.90698],
  "400091": [19.2307, 72.8567],
  "400092": [19.23227, 72.85316],
  "400097": [19.18133, 72.85893],
  "400101": [19.2029, 72.86405],
  "400610": [19.2183, 72.9781],
  "410210": [19.05295, 73.07116],
  "411005": [18.52871, 73.85153],
  "411014": [18.56668, 73.92247],
  "411045": [18.56235, 73.79519],
  "560016": [13.014, 77.67],
  "560036": [13.00875, 77.69398]
};

const CITY_CENTERS = {
  delhi:[28.6139,77.209], "new delhi":[28.6139,77.209], noida:[28.5355,77.391],
  mumbai:[19.076,72.8777], pune:[18.5204,73.8567], banglore:[12.9716,77.5946],
  bangalore:[12.9716,77.5946], bengaluru:[12.9716,77.5946], gurgaon:[28.4595,77.0266],
  gurugram:[28.4595,77.0266], hyderabad:[17.385,78.4867], chennai:[13.0827,80.2707],
  kolkata:[22.5726,88.3639]
};
const $ = (id) => document.getElementById(id);
let doctors = [];
let origin = null;
let geocodeCache = new Map();

function parseCSV(text) {
  const rows=[]; let row=[], cell="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c === '"' && text[i+1] === '"'){cell+='"';i++;}
      else if(c === '"') quoted=false;
      else cell+=c;
    } else if(c === '"') quoted=true;
    else if(c === ','){row.push(cell);cell="";}
    else if(c === '\n' || c === '\r'){
      if(c === '\r' && text[i+1] === '\n') i++;
      row.push(cell); rows.push(row); row=[]; cell="";
    } else cell+=c;
  }
  if(cell.length || row.length){row.push(cell);rows.push(row);}
  return rows;
}
function classifyPayment(raw){
  const t=(raw||"").toLowerCase(), both=t.includes("both");
  const cash=both||t.includes("cash"), insurance=both||t.includes("insurance");
  const label=cash&&insurance?"Cash & Insurance":cash?"Cash only":insurance?"Insurance only":"Not specified";
  return {cash,insurance,label};
}
function classifyVisit(raw){
  const t=(raw||"").toLowerCase(), both=t.includes("both")||(t.includes("opd")&&t.includes("ipd"));
  const opd=both||t.includes("opd"), ipd=both||t.includes("ipd");
  return {opd,ipd,label:opd&&ipd?"OPD & IPD":ipd?"IPD only":opd?"OPD only":"Not specified"};
}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function parseDoctorRows(rows){
  return rows.slice(1).filter(r=>r.some(c=>String(c||"").trim())).map((r,i)=>{
    const [srNo="",name="",specialist="",city="",status="",address="",mapLink="",pay="",visit=""]=r.map(c=>String(c||"").trim());
    const p=classifyPayment(pay),v=classifyVisit(visit);
    const pin=address.match(/\b(\d{6})\b/);
    const pinPoint=pin?PINCODES[pin[1]]:null;
    const cityPoint=CITY_CENTERS[city.toLowerCase()]||null;
    const point=pinPoint||cityPoint;
    const hospital=address.split(" - ")[0].trim();
    return {id:`${srNo}-${i}`,srNo,names:name.split("/").map(n=>n.trim()).filter(Boolean),specialist,city,status,hospital,address,mapLink,
      cash:p.cash,insurance:p.insurance,paymentLabel:p.label,opd:v.opd,ipd:v.ipd,visitLabel:v.label,
      pin:pin?pin[1]:null,lat:point?point[0]:null,lng:point?point[1]:null,precision:pinPoint?"pincode":cityPoint?"city":"none"};
  }).filter(d=>!d.status||d.status.toLowerCase().includes("operational"));
}
async function loadDoctors(force=false){
  const cached=localStorage.getItem("doctorFinderCache");
  if(!force&&cached){try{const obj=JSON.parse(cached);if(Date.now()-obj.at<CACHE_MS&&Array.isArray(obj.data))return obj.data;}catch{}}
  const response=await fetch(SHEET_CSV_URL,{cache:"no-store"});
  if(!response.ok)throw new Error(`Google Sheet request failed (${response.status}). Share the sheet as “Anyone with the link can view”.`);
  const rows=parseCSV(await response.text());
  if(!rows.length||!rows[0].length)throw new Error("The Google Sheet appears to be empty.");
  const result=parseDoctorRows(rows);
  if(!result.length)throw new Error("No operational doctor rows were found. Please verify the sheet headers and Status column.");
  localStorage.setItem("doctorFinderCache",JSON.stringify({at:Date.now(),data:result}));
  return result;
}
function specialtyKeys(spec){
  return (spec||"").split("/").map(s=>s.trim()).filter(Boolean).map(s=>{
    const key=s.toLowerCase().replace(/\s*surgeon$/,"").trim();
    const base=key.replace(/\b\w/g,c=>c.toUpperCase());
    return {key,label:/surgeon$/i.test(s)||["plastic","general"].includes(key)?`${base} Surgeon`:base};
  });
}
function populateSpecialties(){
  const select=$("specialtyFilter"), previous=select.value;
  const opts=new Map();
  doctors.forEach(d=>specialtyKeys(d.specialist).forEach(s=>opts.set(s.key,s.label)));
  select.innerHTML='<option value="any">All specialties</option>'+[...opts.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join("");
  if([...select.options].some(o=>o.value===previous))select.value=previous;
}
function haversineKm(a,b){
  const rad=d=>d*Math.PI/180, dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(s)));
}
function formatKm(km){return km<1?`${Math.round(km*1000)} m`:km<10?`${km.toFixed(1)} km`:`${Math.round(km).toLocaleString("en-IN")} km`;}
async function nominatim(params){
  const qs=new URLSearchParams({format:"json",limit:"1",countrycodes:"in",...params});
  const res=await fetch(`https://nominatim.openstreetmap.org/search?${qs}`,{headers:{"Accept-Language":"en"}});
  if(!res.ok)throw new Error("Address lookup service is unavailable. Please try again.");
  const data=await res.json();
  return data[0]?{lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon),label:data[0].display_name}:null;
}
async function geocodeAddress(input){
  const text=input.trim().replace(/\s+/g," ");
  const full=await nominatim({q:text}); if(full)return full;
  const pin=text.match(/\b\d{6}\b/)?.[0];
  if(pin){const byPin=await nominatim({postalcode:pin});if(byPin)return byPin;}
  const parts=text.split(",").map(p=>p.trim()).filter(Boolean);
  for(let i=1;i<parts.length-1;i++){const found=await nominatim({q:parts.slice(i).join(", ")});if(found)return found;}
  return null;
}
async function reverseLabel(p){
  try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&lat=${p.lat}&lon=${p.lng}`,{headers:{"Accept-Language":"en"}});
    const j=await r.json();return j.display_name||"Your current location";
  }catch{return "Your current location";}
}
function applyFilters(){
  const specialty=$("specialtyFilter").value,payment=$("paymentFilter").value,visit=$("visitFilter").value;
  const found=doctors.filter(d=>
    (specialty==="any"||specialtyKeys(d.specialist).some(s=>s.key===specialty))&&
    (payment==="any"||(payment==="cash"&&d.cash)||(payment==="insurance"&&d.insurance))&&
    (visit==="any"||(visit==="opd"&&d.opd)||(visit==="ipd"&&d.ipd)));
  const result=found.map(doctor=>({doctor,km:origin&&doctor.lat!=null&&doctor.lng!=null?haversineKm(origin,doctor):null}));
  if(origin)result.sort((a,b)=>(a.km??Infinity)-(b.km??Infinity));
  return result;
}
function mapsDirectionsUrl(d){return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`;}
function render(){
  const results=applyFilters();
  $("resultsTitle").innerHTML=`${origin?"Nearest doctors":"All doctors"} <span>(${results.length})</span>`;
  $("sortHint").textContent=origin?"Sorted by estimated distance":"Add your address to sort by distance";
  if(!results.length){$("results").innerHTML='<div class="empty">No doctors match these filters. Try relaxing one of them.</div>';return;}
  $("results").innerHTML=results.map(({doctor:d,km},i)=>{
    const nearest=origin&&km!=null&&i===0;
    const addressParts=d.address.split(" - ");
    const displayAddress=addressParts.slice(1).join(" - ")||d.address;
    const mapUrl=d.mapLink&&/^https?:\/\//i.test(d.mapLink)?d.mapLink:"";
    return `<article class="doctor-card ${nearest?"nearest":""}">
      <div class="card-top"><div class="hospital-block">${nearest?'<span class="nearest-tag">Nearest to you</span>':""}<h3 class="hospital-name"><span class="hospital-icon">✚</span>${esc(d.hospital||"Hospital name not provided")}</h3></div>
      ${km!=null?`<div class="distance">${d.precision==="city"?"≈ ":""}${formatKm(km)}<small>away</small></div>`:""}</div>
      <p class="doctor-names">${esc(d.names.join(" · ")||"Doctor name not provided")}</p>
      <p class="address">${esc(displayAddress)}</p>
      <div class="chips"><span class="chip">⚕ ${esc(d.specialist||"Specialist not listed")}</span><span class="chip">⌖ ${esc(d.city||"City not listed")}</span><span class="chip">₹ ${esc(d.paymentLabel)}</span><span class="chip">${esc(d.visitLabel)}</span></div>
      <div class="card-actions"><a class="directions" href="${esc(mapsDirectionsUrl(d))}" target="_blank" rel="noopener noreferrer">➤ Directions</a>${mapUrl?`<a class="map-link" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">↗ Google Maps</a>`:""}</div>
    </article>`;
  }).join("");
}
function setMessage(msg,isError=true){$("message").textContent=msg||"";$("message").style.color=isError?"#b42318":"#587c85";}
function setBusy(which){
  $("searchBtn").disabled=!!which;$("locationBtn").disabled=!!which;
  $("searchBtn").innerHTML=which==="address"?'<span class="spinner"></span> Searching…':'<span>⌕</span> Find doctors';
  $("locationBtn").innerHTML=which==="gps"?'<span class="spinner"></span> Locating…':'<span>◎</span> Use my location';
}
async function searchAddress(event){
  event?.preventDefault();const input=$("addressInput").value.trim();if(!input)return;
  setBusy("address");setMessage("");
  try{const found=await geocodeAddress(input);if(!found){setMessage("We couldn't find that address. Try adding the area, city or pincode.");return;}
    origin=found;$("originLabel").hidden=false;$("originLabel").textContent=`Showing distances from ${found.label}`;render();
  }catch(e){setMessage(e.message||"Something went wrong.");}
  finally{setBusy(null);}
}
function useLocation(){
  if(!navigator.geolocation){setMessage("Your browser doesn't support location access. Please type your address instead.");return;}
  setBusy("gps");setMessage("");
  navigator.geolocation.getCurrentPosition(async pos=>{
    const p={lat:pos.coords.latitude,lng:pos.coords.longitude};const label=await reverseLabel(p);
    origin={...p,label};$("addressInput").value=label;$("originLabel").hidden=false;$("originLabel").textContent=`Showing distances from ${label}`;
    setBusy(null);render();
  },()=>{setMessage("Location permission was denied or unavailable. Please type your address instead.");setBusy(null);},{enableHighAccuracy:true,timeout:10000});
}
$("searchForm").addEventListener("submit",searchAddress);
$("locationBtn").addEventListener("click",useLocation);
["specialtyFilter","paymentFilter","visitFilter"].forEach(id=>$(id).addEventListener("change",render));

(async function init(){
  try{doctors=await loadDoctors();populateSpecialties();render();}
  catch(error){
    $("results").innerHTML=`<div class="empty"><strong>Couldn't load the doctor list</strong><br><br>${esc(error.message||"Please check your internet connection and Google Sheet sharing settings.")}<br><br><button class="btn btn-primary" id="retryBtn" type="button">Retry loading data</button></div>`;
    $("resultCount").textContent="(error)";
    $("retryBtn").addEventListener("click",async()=>{ $("results").innerHTML='<div class="loading-card"><span class="spinner"></span><p>Loading live sheet data…</p></div>';try{doctors=await loadDoctors(true);populateSpecialties();render();}catch(e){$("results").innerHTML=`<div class="empty">${esc(e.message)}</div>`;}});
  }
})();
