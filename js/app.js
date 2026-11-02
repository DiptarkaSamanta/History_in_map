const map = L.map('map', {zoomControl:true});
map.fitBounds([[8.0, 68.0], [36.0, 96.0]]);

// Mapbox Access Token (loaded from config.js or window)
const MAPBOX_TOKEN = (typeof window !== 'undefined' && window.MAPBOX_TOKEN) || '';
const hasMapbox = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== 'YOUR_MAPBOX_ACCESS_TOKEN' && MAPBOX_TOKEN.startsWith('pk.'));

const baseMaps = {};

const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});
baseMaps["CartoDB Voyager (Atlas)"] = voyagerLayer;

if (hasMapbox) {
  const mapboxOutdoors = L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  );

  const mapboxStreets = L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  );

  const mapboxDark = L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  );

  const mapboxSatellite = L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  );

  baseMaps["Mapbox Outdoors (Terrain)"] = mapboxOutdoors;
  baseMaps["Mapbox Streets"] = mapboxStreets;
  baseMaps["Mapbox Dark"] = mapboxDark;
  baseMaps["Mapbox Satellite"] = mapboxSatellite;

  mapboxOutdoors.addTo(map);
} else {
  voyagerLayer.addTo(map);
}

L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

const state = {year:1600, kingdoms:[], rulers:[], wars:[], boundaries:null, selected:null};
const borderLayer = L.geoJSON(null, {style: feature => ({
  color: colorFor(feature.properties.id), weight:2.5, dashArray:'5 5', fillColor: colorFor(feature.properties.id), fillOpacity:0.22
}), onEachFeature:(feature, layer)=>{
  const k=state.kingdoms.find(x=>x.id===feature.properties.id);
  if(k){layer.bindTooltip(`<b>${k.name}</b><br>${fmtYear(k.start)} – ${fmtYear(k.end)}`, {sticky:true});layer.on('click',()=>showKingdom(k));}
}}).addTo(map);
const capitalLayer = L.layerGroup().addTo(map);
const warLayer = L.layerGroup();
const palette = ['#286b9b','#a66b27','#4c8269','#875d9f','#b05252','#6685a9'];

function fmtYear(y){return y<0?`${Math.abs(y)} BCE`:`${y} CE`;}
function active(k,y){return y>=Math.min(k.start,k.end)&&y<=Math.max(k.start,k.end);}
function colorFor(id){let n=0;for(const c of id)n+=c.charCodeAt(0);return palette[n%palette.length];}
function update(){
  document.getElementById('yearLabel').textContent=fmtYear(state.year);
  document.getElementById('yearSlider').value=state.year;
  document.getElementById('eraLabel').textContent=state.year<600?'Ancient':state.year<1200?'Early Medieval':state.year<1700?'Medieval / Early Modern':'Modern';
  const activeKingdoms=state.kingdoms.filter(k=>active(k,state.year));
  document.getElementById('kingdomCount').textContent=activeKingdoms.length;
  renderList();
  drawMap(activeKingdoms);
}
function drawMap(items){
  borderLayer.clearLayers();capitalLayer.clearLayers();warLayer.clearLayers();
  if(document.getElementById('bordersToggle').checked && state.boundaries){
    const ids=new Set(items.map(k=>k.id));
    borderLayer.addData({...state.boundaries,features:state.boundaries.features.filter(f=>ids.has(f.properties.id))});
  }
  if(document.getElementById('capitalsToggle').checked){
    items.forEach(k=>{
      const [lon,lat]=k.capitalCoords;
      L.circleMarker([lat,lon],{radius:5,color:'#fff',weight:1.5,fillColor:colorFor(k.id),fillOpacity:1})
       .bindPopup(`<b>${k.capital}</b><br>${k.name}`).on('click',()=>showKingdom(k)).addTo(capitalLayer);
    });
  }
  if(document.getElementById('warsToggle').checked){
    state.wars.filter(w=>state.year>=w.start&&state.year<=w.end).forEach(w=>{
      const [lon,lat]=w.coords;
      L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div style="width:13px;height:13px;background:#d34e4e;border:2px solid white;transform:rotate(45deg);box-shadow:0 1px 5px #333"></div>',iconSize:[15,15],iconAnchor:[7,7]})})
       .bindPopup(`<b>${w.name}</b><br>${w.location}<br>${fmtYear(w.start)}`).on('click',()=>showWar(w)).addTo(warLayer);
    });
    warLayer.addTo(map);
  }
}
function renderList(){
  const q=document.getElementById('searchBox').value.toLowerCase();
  const list=document.getElementById('kingdomList');list.innerHTML='';
  const items=state.kingdoms.filter(k=>active(k,state.year)&&[k.name,k.region,...k.rulers].join(' ').toLowerCase().includes(q));
  items.forEach(k=>{
    const b=document.createElement('button');b.className='kingdom-item'+(state.selected===k.id?' active':'');
    b.innerHTML=`<span>${k.name}<small>${k.region} · ${fmtYear(k.start)}–${fmtYear(k.end)}</small></span><span class="arrow">›</span>`;
    b.onclick=()=>showKingdom(k);list.appendChild(b);
  });
  if(!items.length)list.innerHTML='<p class="hint">No active kingdoms match this search and year.</p>';
}
function showKingdom(k){
  state.selected=k.id;renderList();
  const related=state.wars.filter(w=>w.participants.some(p=>p.toLowerCase().includes(k.name.toLowerCase().split(' ')[0])));
  document.getElementById('details').innerHTML=`
    <div class="detail-kicker">${k.era} · ${k.region}</div><h2 class="detail-title">${k.name}</h2>
    <div class="detail-meta">Approximate period: ${fmtYear(k.start)} – ${fmtYear(k.end)}<br>Capital: ${k.capital}</div>
    <p class="detail-body">${k.summary}</p>
    <div class="detail-block"><h3>Known rulers to explore</h3>${k.rulers.map(r=>`<span class="tag">${r}</span>`).join('')}</div>
    <div class="detail-block"><h3>Historical context</h3><p class="detail-body">${k.notes}</p></div>
    <div class="detail-block"><h3>Related conflicts in starter data</h3>${related.length?related.map(w=>`<div class="battle-row"><strong>${w.name}</strong><span>${fmtYear(w.start)} · ${w.outcome}</span></div>`).join(''):'<p class="detail-meta">No directly linked conflict in this starter sample. Add researched records to wars.json.</p>'}</div>`;
}
function showWar(w){
  document.getElementById('details').innerHTML=`<div class="detail-kicker">War / battle record</div><h2 class="detail-title">${w.name}</h2><div class="detail-meta">${fmtYear(w.start)}${w.end!==w.start?' – '+fmtYear(w.end):''}<br>Location: ${w.location}</div><p class="detail-body">${w.description}</p><div class="detail-block"><h3>Participants</h3>${w.participants.map(p=>`<span class="tag">${p}</span>`).join('')}</div><div class="detail-block"><h3>Outcome</h3><p class="detail-body">${w.outcome}</p></div><div class="detail-block"><h3>Research note</h3><p class="detail-meta">${w.certainty}</p></div>`;
}
async function init(){
  try{
    const fetchDataset = async (apiPath, staticPath) => {
      try {
        const res = await fetch(apiPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data !== undefined ? json.data : json;
      } catch (err) {
        return fetch(staticPath).then(x => x.json());
      }
    };

    const [k, r, w, b] = await Promise.all([
      fetchDataset('/api/kingdoms', 'data/kingdoms.json'),
      fetchDataset('/api/rulers', 'data/rulers.json'),
      fetchDataset('/api/wars', 'data/wars.json'),
      fetchDataset('/api/boundaries', 'data/boundaries.geojson')
    ]);
    state.kingdoms = k;
    state.rulers = r;
    state.wars = w;
    state.boundaries = b;
    update();
    setTimeout(() => map.invalidateSize(), 200);
  }catch(e){console.error(e);document.getElementById('kingdomList').innerHTML='<p class="hint">Could not load project data. Run the app through a local web server, not by double-clicking index.html.</p>';}
}
window.addEventListener('resize', () => map.invalidateSize());
window.addEventListener('load', () => setTimeout(() => map.invalidateSize(), 100));
document.getElementById('yearSlider').addEventListener('input',e=>{state.year=Number(e.target.value);update();});
document.getElementById('prevEra').onclick=()=>{state.year=Math.max(-500,state.year-100);update();};
document.getElementById('nextEra').onclick=()=>{state.year=Math.min(2000,state.year+100);update();};
document.getElementById('resetYear').onclick=()=>{state.year=1600;update();};
document.getElementById('searchBox').addEventListener('input',renderList);
['bordersToggle','capitalsToggle','warsToggle'].forEach(id=>document.getElementById(id).addEventListener('change',update));
init();
