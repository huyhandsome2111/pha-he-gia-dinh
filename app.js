const KEY="family-tree-v1";
const sample=[
{id:"me",name:"Tôi",nickname:"Tôi",gender:"male",birth:2006,job:"",hometown:"",father:"dad",mother:"mom",spouse:"",birthOrder:1,notes:"Nhân vật chính"},
{id:"brother",name:"Anh",nickname:"Anh",gender:"male",birth:2008,job:"",hometown:"",father:"dad",mother:"mom",spouse:"",birthOrder:2,notes:""},
{id:"dad",name:"Ba ruột",nickname:"Ba",gender:"male",birth:1978,job:"",hometown:"",father:"grandpa",mother:"grandma",spouse:"mom",birthOrder:1,notes:""},
{id:"mom",name:"Mẹ ruột",nickname:"Mẹ",gender:"female",birth:1980,job:"",hometown:"",father:"",mother:"",spouse:"dad",birthOrder:1,notes:""},
{id:"uncle",name:"Chú ruột",nickname:"Chú",gender:"male",birth:1982,job:"",hometown:"",father:"grandpa",mother:"grandma",spouse:"auntInLaw",birthOrder:2,notes:"Em trai của ba"},
{id:"auntInLaw",name:"Thím",nickname:"Thím",gender:"female",birth:1984,job:"",hometown:"",father:"",mother:"",spouse:"uncle",birthOrder:1,notes:"Vợ của chú"},
{id:"cousin",name:"Anh họ",nickname:"Anh họ",gender:"male",birth:2004,job:"",hometown:"",father:"uncle",mother:"auntInLaw",spouse:"",birthOrder:1,notes:"Con của chú"},
{id:"cousinSister",name:"Chị họ",nickname:"Chị họ",gender:"female",birth:1988,job:"",hometown:"",father:"uncle",mother:"auntInLaw",spouse:"",birthOrder:2,notes:"Con của chú"},
{id:"grandpa",name:"Ông nội",nickname:"Ông nội",gender:"male",birth:1950,job:"",hometown:"",father:"ggp",mother:"ggm",spouse:"grandma",birthOrder:1,notes:"Ba của ba ruột"},
{id:"grandma",name:"Bà nội",nickname:"Bà nội",gender:"female",birth:1953,job:"",hometown:"",father:"",mother:"",spouse:"grandpa",birthOrder:1,notes:""},
{id:"ggp",name:"Cụ ông nội",nickname:"Cụ ông",gender:"male",birth:1925,job:"",hometown:"",father:"",mother:"",spouse:"ggm",birthOrder:1,notes:""},
{id:"ggm",name:"Cụ bà nội",nickname:"Cụ bà",gender:"female",birth:1928,job:"",hometown:"",father:"",mother:"",spouse:"ggp",birthOrder:1,notes:""}
];
let people=load(), selectedId="", relationMainId="me", relationTargetId="me", scale=window.innerWidth<=700?.78:1, drag={on:false,x:0,y:0,l:0,t:0};
let viewHasInteracted=false;
let modalPhoto="";
let positionMode=false;
let manualPositions={};
let positionSelection=new Set();
let activePositionDrag=null;
let positionHoldTimer=null;
try{manualPositions=JSON.parse(safeStorageGet("family-tree-positions-v4")||"{}")}catch{manualPositions={}}

function cloneSample(){return JSON.parse(JSON.stringify(sample))}
function safeStorageGet(key){try{return localStorage.getItem(key)}catch{return null}}
function safeStorageSet(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}
function sanitizePeople(data){
  if(!Array.isArray(data))return cloneSample();
  const out=[];const seen=new Set();
  for(const raw of data){
    if(!raw||typeof raw!=="object")continue;
    const id=String(raw.id||"");
    const name=String(raw.name||raw.nickname||"").trim();
    if(!id||!name||seen.has(id))continue;
    out.push({...raw,id,name,nickname:String(raw.nickname||name),gender:raw.gender==="female"?"female":raw.gender==="male"?"male":"other",birth:raw.birth||"",job:String(raw.job||""),hometown:String(raw.hometown||""),father:raw.father||"",mother:raw.mother||"",spouse:raw.spouse||"",birthOrder:Number(raw.birthOrder)||"",notes:String(raw.notes||""),photo:String(raw.photo||"")});
    seen.add(id);
  }
  if(!out.length)return cloneSample();
  const ids=new Set(out.map(p=>p.id));
  out.forEach(p=>{
    if(!ids.has(p.father)||p.father===p.id)p.father="";
    if(!ids.has(p.mother)||p.mother===p.id)p.mother="";
    if(!ids.has(p.spouse)||p.spouse===p.id)p.spouse="";
  });
  out.forEach(p=>{if(p.spouse){const s=out.find(x=>x.id===p.spouse);if(s)s.spouse=p.id}});
  return out;
}
function load(){const raw=safeStorageGet(KEY);if(!raw)return cloneSample();try{return sanitizePeople(JSON.parse(raw))}catch{return cloneSample()}}
let cloud={ready:false,user:null,db:null,saveTimer:null,remoteRef:null,remoteApplying:false};
function firebaseConfigured(){
  const c=window.FIREBASE_CONFIG||{};
  return c.apiKey && !String(c.apiKey).startsWith("YOUR_") && c.projectId && !String(c.projectId).startsWith("YOUR_");
}
function setSyncStatus(text){
  let el=document.querySelector("#syncStatus");
  if(!el){el=document.createElement("span");el.id="syncStatus";el.className="sync-status";document.querySelector(".top-actions")?.appendChild(el)}
  el.textContent=text||"";
}
function localSnapshot(){return {people,manualPositions,updatedAt:firebase.database.ServerValue.TIMESTAMP}};
function save(){
  safeStorageSet(KEY,JSON.stringify(people));
  safeStorageSet("family-tree-positions-v4",JSON.stringify(manualPositions));
  if(cloud.ready&&cloud.db&&cloud.user&&!cloud.remoteApplying){
    clearTimeout(cloud.saveTimer);
    setSyncStatus("Đang lưu…");
    cloud.saveTimer=setTimeout(async()=>{
      try{
        await cloud.db.ref(`users/${cloud.user.uid}`).update(localSnapshot());
        setSyncStatus("Đã đồng bộ");
      }catch(err){console.error(err);setSyncStatus("Lỗi đồng bộ")}
    },350);
  }
}
function applyCloudData(data){
  if(!data||typeof data!=="object")return;
  cloud.remoteApplying=true;
  try{
    if(Array.isArray(data.people))people=sanitizePeople(data.people);
    if(data.manualPositions&&typeof data.manualPositions==="object")manualPositions=data.manualPositions;
    safeStorageSet(KEY,JSON.stringify(people));
    safeStorageSet("family-tree-positions-v4",JSON.stringify(manualPositions));
    if(selectedId&&!get(selectedId))selectedId="";
    renderAll();
  }finally{cloud.remoteApplying=false}
}
async function initGoogleSync(){
  if(!firebaseConfigured()){setSyncStatus("Chưa cấu hình Google");return;}
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
    cloud.db=firebase.database();
    firebase.auth().onAuthStateChanged(async user=>{
      cloud.user=user||null;
      cloud.ready=false;
      if(cloud.remoteRef){try{cloud.remoteRef.off()}catch{} cloud.remoteRef=null;}
      if(!user){setSyncStatus("Chưa đăng nhập");updateGoogleButton();return;}
      setSyncStatus("Đang đồng bộ…");
      try{
        const ref=cloud.db.ref(`users/${user.uid}`);
        cloud.remoteRef=ref;
        const snap=await ref.once("value");
        const data=snap.val();
        if(data&&Array.isArray(data.people)){
          applyCloudData(data);
        }else{
          await ref.update(localSnapshot());
        }
        ref.on("value",snap2=>{
          if(!snap2.exists()||cloud.remoteApplying)return;
          const incoming=snap2.val();
          // Firebase sends our own write back too; applying it is harmless and keeps both devices aligned.
          applyCloudData(incoming);
          setSyncStatus("Đã đồng bộ");
        },err=>{console.error(err);setSyncStatus("Lỗi đồng bộ")});
        cloud.ready=true;
        setSyncStatus(`✓ ${user.displayName||user.email||"Google"}`);
      }catch(err){console.error(err);setSyncStatus("Lỗi đồng bộ: "+(err.message||"không xác định"))}
      updateGoogleButton();
    });
  }catch(err){console.error(err);setSyncStatus("Không khởi tạo được Firebase")}
}
function updateGoogleButton(){
  const btn=document.querySelector("#googleBtn");
  if(!btn)return;
  if(cloud.user){btn.textContent="↪ Đăng xuất Google";btn.title=cloud.user.email||"";}
  else btn.textContent="G Đăng nhập Google";
}
async function googleLogin(){
  if(!firebaseConfigured()){
    alert("Chưa cấu hình Firebase. Hãy mở firebase-config.js và điền cấu hình Web App của dự án Firebase trước khi đăng nhập Google.");
    return;
  }
  try{
    const provider=new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  }catch(err){console.error(err);alert("Không đăng nhập được Google: "+(err.message||err));}
}
async function googleLogout(){try{await firebase.auth().signOut()}catch(err){console.error(err)}}

const $=s=>document.querySelector(s);
function get(id){return people.find(p=>p.id===id)}
function esc(s=""){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function avatar(p){return p?.photo?`<img src="${p.photo}">`:(p?.gender==="female"?"👩":"👨")}
function relLabel(a,b){
  if(!a||!b)return "";
  if(a.id===b.id)return "chính mình";
  const kids=childrenOf(a.id);
  if(kids.some(x=>x.id===b.id)) return b.gender==="female"?"con gái":"con trai";
  if(childrenOf(b.id).some(x=>x.id===a.id)) return a.gender==="female"?"mẹ":"ba";
  if(a.spouse===b.id||b.spouse===a.id)return a.gender==="female"?"vợ":"chồng";
  return "";
}
function childrenOf(id){return people.filter(p=>p.father===id||p.mother===id)}
function parentsOf(id){const p=get(id);return [get(p?.father),get(p?.mother)].filter(Boolean)}
function siblingsOf(id){const p=get(id);if(!p)return[];let s=new Set();[p.father,p.mother].filter(Boolean).forEach(pid=>childrenOf(pid).forEach(x=>{if(x.id!==id)s.add(x.id)}));return [...s].map(get)}
function ancestors(id,max=12){
  const out=[]; let cur=get(id), depth=0;
  while(cur&&depth<max){let f=get(cur.father),m=get(cur.mother); if(f)out.push({person:f,depth:depth+1,via:"cha"});if(m)out.push({person:m,depth:depth+1,via:"mẹ"});cur=f;depth++}
  return out;
}
function findPath(start,target){
  if(start===target)return [start];
  const q=[[start]], seen=new Set([start]);
  while(q.length){const path=q.shift(),id=path[path.length-1],p=get(id);const links=[p.father,p.mother,p.spouse,...siblingsOf(id).map(x=>x.id),...childrenOf(id).map(x=>x.id)].filter(Boolean);
    for(const n of links){if(seen.has(n))continue;const np=[...path,n];if(n===target)return np;seen.add(n);q.push(np)}
  } return null;
}
function relationship(mainId,targetId){
  if(mainId===targetId)return {title:"Chính mình",path:[mainId]};
  const main=get(mainId), target=get(targetId);
  const path=findPath(mainId,targetId);
  if(!path)return {title:"Chưa xác định",path:[]};
  // Direct ancestors
  let cur=main;
  for(let d=1;d<=8;d++){
    const f=get(cur?.father),m=get(cur?.mother);
    if(targetId===f?.id)return {title:ancestorTerm(main,target,d,"male"),path};
    if(targetId===m?.id)return {title:ancestorTerm(main,target,d,"female"),path};
    cur=f||m;
  }
  // descendants
  cur=main;
  for(let d=1;d<=8;d++){
    const kids=childrenOf(cur?.id); if(kids.some(k=>k.id===targetId)) return {title:descendantTerm(target,d),path};
    cur=kids[0];
  }
  // spouse
  if(main.spouse===targetId||target.spouse===mainId)return {title:main.gender==="female"?"chồng":"vợ",path};
  // sibling / sibling's spouse
  if(siblingsOf(mainId).some(x=>x.id===targetId)){
    const s=get(targetId);
    const parent=get(main.father)||get(main.mother);
    const order=s.birthOrder-main.birthOrder;
    if(order<0)return {title:s.gender==="female"?"chị":"anh",path};
    if(order>0)return {title:s.gender==="female"?"em gái":"em trai",path};
    return {title:"anh/chị/em",path};
  }
  const sibs=siblingsOf(mainId);
  const sibTargetParent=target.father||target.mother;
  if(sibs.some(s=>s.id===sibTargetParent)){
    const parent=sibs.find(s=>s.id===sibTargetParent);
    return {title: cousinTerm(main,target,parent),path};
  }
  // uncle/aunt via parent sibling
  const mainParents=parentsOf(mainId);
  for(const par of mainParents){
    const sibs2=siblingsOf(par.id);
    if(sibs2.some(s=>s.id===targetId)){
      return {title:elderRelativeTerm(par,target),path};
    }
  }
  // spouse of uncle/aunt
  for(const par of mainParents){
    const sibs2=siblingsOf(par.id);
    if(sibs2.some(s=>s.spouse===targetId)){
      const t=get(targetId);
      return {title:t.gender==="female"?"thím/dì/mợ":"dượng",path};
    }
  }
  return {title:"Họ hàng (cần bổ sung quan hệ)",path};
}
function ancestorTerm(main,target,d,gender){
  if(d===1)return gender==="male"?"ba":"mẹ";
  if(d===2)return gender==="male"?"ông nội/ông ngoại":"bà nội/bà ngoại";
  if(d===3)return gender==="male"?"cụ ông":"cụ bà";
  return gender==="male"?"cụ ông":"cụ bà";
}
function descendantTerm(target,d){if(d===1)return target.gender==="female"?"con gái":"con trai";if(d===2)return target.gender==="female"?"cháu gái":"cháu trai";return "hậu duệ"}
function cousinTerm(main,target,parent){
  const age=(target.birth||9999)-(main.birth||9999);
  if(age<0)return target.gender==="female"?"chị họ":"anh họ";
  if(age>0)return target.gender==="female"?"em họ":"em họ";
  return "anh/chị/em họ";
}
function elderRelativeTerm(parent,target){
  const sameGender=target.gender==="female";
  const order=(target.birthOrder||99)-(parent.birthOrder||99);
  if(order<0)return sameGender?"cô/bác":"bác";
  return sameGender?"cô/dì":"chú";
}

function renderSelects(autoTarget=false){
  const mainEl=$("#mainPerson"),targetEl=$("#targetPerson");
  if(!mainEl||!targetEl)return;
  const opts=people.map(p=>`<option value="${p.id}">${esc(p.nickname||p.name)}</option>`).join("");
  const me=people.find(p=>normalizeText(p.nickname||"")==="toi"||normalizeText(p.name||"")==="toi")||get("me")||people[0];
  const mainId=me?.id||people[0]?.id||"";
  if(!relationMainId||!get(relationMainId))relationMainId=mainId;
  if(autoTarget)relationTargetId=selectedId||relationTargetId||mainId;
  if(!relationTargetId||!get(relationTargetId))relationTargetId=selectedId||people[0]?.id||mainId;
  mainEl.innerHTML=opts;targetEl.innerHTML=opts;
  mainEl.value=relationMainId;
  targetEl.value=relationTargetId;
}
function renderAutoRelation(){
  const a=relationMainId&&get(relationMainId)?relationMainId:($("#mainPerson")?.value||"");
  const b=relationTargetId&&get(relationTargetId)?relationTargetId:($("#targetPerson")?.value||"");
  if(!a||!b){$("#relationResult").innerHTML="";return;}
  relationMainId=a;relationTargetId=b;
  if($("#mainPerson"))$("#mainPerson").value=a;
  if($("#targetPerson"))$("#targetPerson").value=b;
  const r=relationship(a,b),names=r.path.map(get).filter(Boolean);
  $("#relationResult").innerHTML=`<div class="relation-path"><div class="path-title">Đường quan hệ</div><div class="path">${names.length?names.map((p,i)=>`<span>${esc(p.nickname||p.name)}</span>${i<names.length-1?"→":""}`).join(""):"<span>Chưa xác định</span>"}</div></div><div class="answer"><small>${esc(get(a)?.nickname||get(a)?.name)} gọi ${esc(get(b)?.nickname||get(b)?.name)} là</small><strong>${esc(r.title)}</strong></div>`;
}
function renderProfile(){
  const p=get(selectedId);if(!p){$("#profile").innerHTML='<div class="empty">Chưa chọn người.</div>';return}
  const parents=parentsOf(p.id),kids=childrenOf(p.id),siblings=siblingsOf(p.id);
  const me=people.find(x=>normalizeText(x.nickname||"")==="toi" || normalizeText(x.name)==="toi") || get("me");
  let callout="";
  if(me && me.id!==p.id){
    const r=relationship(me.id,p.id);
    callout=`<div class="callout"><div class="callout-label">CÁCH XƯNG HÔ VỚI NGƯỜI NÀY</div><div class="callout-main">Tôi gọi <b>${esc(p.nickname||p.name)}</b> là <strong>${esc(r.title)}</strong></div><div class="muted">Quan hệ được suy ra từ cây gia đình.</div></div>`;
  }
  $("#profile").innerHTML=`<div class="profile">
    ${callout}
    <div class="profile-top"><div class="avatar">${avatar(p)}</div><div><h3>${esc(p.name)}</h3><div class="sub">${esc(p.nickname||"")} ${p.birth?`• ${p.birth}`:""}</div></div></div>
    <div class="info-grid">
      <div class="info"><b>GIỚI TÍNH</b><span>${p.gender==="female"?"Nữ":p.gender==="male"?"Nam":"Khác"}</span></div>
      <div class="info"><b>NGHỀ NGHIỆP</b><span>${esc(p.job||"—")}</span></div>
      <div class="info"><b>QUÊ QUÁN</b><span>${esc(p.hometown||"—")}</span></div>
      <div class="info"><b>THỨ TỰ SINH</b><span>${p.birthOrder||"—"}</span></div>
    </div>
    ${p.notes?`<div class="family-list"><h4>Ghi chú</h4><div class="muted">${esc(p.notes)}</div></div>`:""}
    <div class="family-list"><h4>CHA MẸ</h4>${parents.length?parents.map(personRow).join(""):"<div class='muted'>Chưa khai báo</div>"}</div>
    <div class="family-list"><h4>VỢ / CHỒNG</h4>${p.spouse?personRow(get(p.spouse)):"<div class='muted'>Chưa khai báo</div>"}</div>
    <div class="family-list"><h4>CON (${kids.length})</h4>${kids.length?kids.map(personRow).join(""):"<div class='muted'>Chưa khai báo</div>"}</div>
    <div class="family-list"><h4>ANH / CHỊ / EM</h4>${siblings.length?siblings.map(personRow).join(""):"<div class='muted'>Chưa xác định</div>"}</div>
    <div class="profile-actions">
      <button id="editSelected" class="ghost full">✎ Đổi tên / sửa thông tin</button>
      <button id="changeAvatarSelected" class="ghost full">📷 Đổi ảnh avatar</button>
    </div>
    <input id="quickAvatarInput" class="hidden" type="file" accept="image/*">
  </div>`;
  $("#editSelected").onclick=()=>openModal(p.id);
  $("#changeAvatarSelected").onclick=()=>$("#quickAvatarInput").click();
  $("#quickAvatarInput").onchange=e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      const person=get(p.id);
      if(!person)return;
      person.photo=r.result;
      save();
      renderAll();
    };
    r.readAsDataURL(f);
  };
}
function personRow(p){return p?`<div class="family-item" data-person="${p.id}"><div class="mini">${avatar(p)}</div><span>${esc(p.name)}</span></div>`:""}
function getPositionBox(ids,dx=0,dy=0){
  const canvas=document.querySelector("#treeCanvas");
  if(!canvas||!ids.length)return null;
  const cards=ids.map(id=>{
    const el=canvas.querySelector(`[data-card-id="${id}"]`);
    if(!el)return null;
    const x=parseFloat(el.style.left)||0,y=parseFloat(el.style.top)||0;
    return {id,x:x+dx,y:y+dy,w:el.offsetWidth||NODE_W,h:el.offsetHeight||NODE_H};
  }).filter(Boolean);
  if(!cards.length)return null;
  const minX=Math.min(...cards.map(c=>c.x)),minY=Math.min(...cards.map(c=>c.y));
  const maxX=Math.max(...cards.map(c=>c.x+c.w)),maxY=Math.max(...cards.map(c=>c.y+c.h));
  return {minX,minY,maxX,maxY,w:maxX-minX,h:maxY-minY};
}
function isPositionMoveValid(ids,dx,dy){
  const canvas=document.querySelector("#treeCanvas");
  const box=getPositionBox(ids,dx,dy);
  if(!canvas||!box)return false;
  const pad=12;
  const cw=canvas.offsetWidth||MIN_WIDTH,ch=canvas.offsetHeight||800;
  if(box.minX<pad||box.minY<pad||box.maxX>cw-pad||box.maxY>ch-pad)return false;
  const moving=new Set(ids);
  const cards=[...canvas.querySelectorAll(".tree-card")].map(el=>({
    id:el.dataset.cardId,x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0,w:el.offsetWidth||NODE_W,h:el.offsetHeight||NODE_H
  }));
  const movedCards=cards.filter(c=>moving.has(c.id)).map(c=>({...c,x:c.x+dx,y:c.y+dy}));
  const still=cards.filter(c=>!moving.has(c.id));
  const gap=10;
  for(const a of movedCards){
    for(const b of still){
      const overlap=a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
      if(overlap)return false;
    }
  }
  for(let i=0;i<movedCards.length;i++)for(let j=i+1;j<movedCards.length;j++){
    const a=movedCards[i],b=movedCards[j];
    const overlap=a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
    if(overlap)return false;
  }
  return true;
}

// Giữ luật nền của phả hệ: khung có thể dịch chuyển, nhưng connector cha/mẹ → con
// luôn phải là một đường dọc duy nhất, đi từ trung điểm cặp cha/mẹ tới trung điểm
// nhóm con. Connector vợ/chồng luôn là một đường ngang. Khi các khung lệch nhau,
// hệ thống điều chỉnh vị trí các nhóm thay vì bẻ connector thành đường gấp/chéo.
function enforcePedigreeStraight(groups, positions, nodeW, nodeH, maxPasses=80){
  if(!groups?.length)return;
  const centerX=id=>positions[id]?positions[id].x+nodeW/2:0;
  const groupCenterX=g=>{
    const vals=g.ids.map(centerX).filter(Number.isFinite);
    if(!vals.length)return 0;
    return (Math.min(...vals)+Math.max(...vals))/2;
  };
  const groupY=g=>{
    const vals=g.ids.map(id=>positions[id]?.y).filter(Number.isFinite);
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  };
  const shiftGroup=(g,dx=0,dy=0)=>{
    if(!g)return;
    g.ids.forEach(id=>{
      if(!positions[id])return;
      positions[id].x+=dx;
      positions[id].y+=dy;
    });
  };
  const childKey=g=>g.key||g.ids.slice().sort().join('|');

  for(let pass=0;pass<maxPasses;pass++){
    let maxErr=0;

    // Vợ/chồng luôn nằm cùng một hàng để đường nối của họ là đường ngang.
    for(const g of groups){
      if(g.ids.length!==2)continue;
      const a=positions[g.ids[0]],b=positions[g.ids[1]];
      if(!a||!b)continue;
      const y=(a.y+b.y)/2;
      a.y=y;b.y=y;
    }

    // Các anh/chị/em cùng một nhóm con nằm cùng một hàng ngang.
    for(const pg of groups){
      const seen=new Set();
      const childGroups=pg.children.map(c=>c.group).filter(g=>g&&!seen.has(childKey(g))&&seen.add(childKey(g)));
      if(childGroups.length<2)continue;
      const y=childGroups.reduce((sum,g)=>sum+groupY(g),0)/childGroups.length;
      childGroups.forEach(g=>shiftGroup(g,0,y-groupY(g)));
    }

    // Ép trung điểm cha/mẹ trùng trung điểm nhóm con.
    for(const pg of groups){
      const children=pg.children.filter(c=>positions[c.childId]);
      if(!children.length)continue;
      children.sort((a,b)=>{
        const ao=Number(get(a.childId)?.birthOrder)||Number.MAX_SAFE_INTEGER;
        const bo=Number(get(b.childId)?.birthOrder)||Number.MAX_SAFE_INTEGER;
        if(ao!==bo)return ao-bo;
        return people.findIndex(p=>p.id===a.childId)-people.findIndex(p=>p.id===b.childId);
      });
      const parentX=groupCenterX(pg);
      const childClusterX=children.length===1
        ? centerX(children[0].childId)
        : (centerX(children[0].childId)+centerX(children[children.length-1].childId))/2;
      const delta=parentX-childClusterX;
      maxErr=Math.max(maxErr,Math.abs(delta));
      if(Math.abs(delta)<0.25)continue;

      // Chia đều hiệu chỉnh cho hai phía: nửa trên cha/mẹ, nửa dưới nhóm con.
      // Nhờ lặp nhiều vòng, các trường hợp Ba-Mẹ cùng lúc thuộc hai nhánh nội/ngoại
      // cũng tự hội tụ mà không cần nhân bản người.
      shiftGroup(pg,-delta*0.5,0);
      const seen=new Set();
      for(const c of children){
        const cg=c.group;
        if(!cg||seen.has(childKey(cg)))continue;
        seen.add(childKey(cg));
        shiftGroup(cg,delta*0.5,0);
      }
    }

    if(maxErr<0.25)break;
  }
}

function syncManualPositionsFromLayout(positions, manualPositions){
  if(!manualPositions||typeof manualPositions!=="object")return;
  let changed=false;
  for(const key of Object.keys(manualPositions)){
    if(!key.startsWith("person:"))continue;
    const id=key.slice(7), pos=positions[id];
    if(!pos)continue;
    const next={x:Math.round(pos.x),y:Math.round(pos.y)};
    const cur=manualPositions[key];
    if(cur?.x!==next.x||cur?.y!==next.y){manualPositions[key]=next;changed=true;}
  }
  if(changed)safeStorageSet("family-tree-positions-v4",JSON.stringify(manualPositions));
}

function renderPositionSelection(){
  document.querySelectorAll(".tree-card.position-selected").forEach(el=>el.classList.remove("position-selected"));
  const canvas=document.querySelector("#treeCanvas");
  if(!canvas)return;
  positionSelection.forEach(id=>canvas.querySelector(`[data-card-id="${id}"]`)?.classList.add("position-selected"));
  updateSelectionFrame();
}
function updateSelectionFrame(dx=0,dy=0){
  const canvas=document.querySelector("#treeCanvas");
  if(!canvas)return;
  let frame=canvas.querySelector(".position-selection-frame");
  if(!positionSelection.size){if(frame)frame.remove();return;}
  const box=getPositionBox([...positionSelection],dx,dy);
  if(!box){if(frame)frame.remove();return;}
  if(!frame){frame=document.createElement("div");frame.className="position-selection-frame";canvas.appendChild(frame);}
  frame.style.left=(box.minX-8)+"px";frame.style.top=(box.minY-8)+"px";frame.style.width=(box.w+16)+"px";frame.style.height=(box.h+16)+"px";
  const valid=isPositionMoveValid([...positionSelection],dx,dy);
  frame.classList.toggle("invalid",!valid);
  frame.classList.toggle("valid",valid);
}

function updateDragConnectors(ids,dx,dy){
  const canvas=document.querySelector('#treeCanvas');
  const svg=canvas?.querySelector('.family-connectors');
  if(!canvas||!svg)return;

  const moving=new Set(ids);
  const live={};
  people.forEach(p=>{
    const el=canvas.querySelector(`[data-card-id="${p.id}"]`);
    if(!el)return;
    const baseX=parseFloat(el.style.left)||0;
    const baseY=parseFloat(el.style.top)||0;
    const dd=moving.has(p.id)?[dx,dy]:[0,0];
    live[p.id]={x:baseX+dd[0],y:baseY+dd[1]};
  });

  const nodeW=window.innerWidth<=700?128:160;
  const nodeH=window.innerWidth<=700?66:78;
  const coupleGap=window.innerWidth<=700?14:24;
  const used=new Set(),groups=[],groupByPerson=new Map();
  const keyOf=(a,b)=>[a,b].filter(Boolean).sort().join('|');

  for(const p of people){
    if(used.has(p.id)||!live[p.id])continue;
    const spouse=(p.spouse&&get(p.spouse)&&p.spouse!==p.id&&live[p.spouse])?get(p.spouse):null;
    const ids2=spouse?[p.id,spouse.id]:[p.id];
    const g={key:keyOf(...ids2),ids:ids2,children:[],parents:new Set()};
    groups.push(g);ids2.forEach(id=>{used.add(id);groupByPerson.set(id,g)});
  }
  const addChild=(pg,cg,id)=>{
    if(!pg||!cg||pg===cg)return;
    if(pg.children.some(c=>c.childId===id))return;
    pg.children.push({group:cg,childId:id});cg.parents.add(pg);
  };
  for(const child of people){
    const cg=groupByPerson.get(child.id);if(!cg)continue;
    for(const pid of [child.father,child.mother].filter(Boolean))addChild(groupByPerson.get(pid),cg,child.id);
  }

  // Trong lúc kéo, hệ thống cũng giữ đúng luật connector. Khung có thể được
  // tự điều chỉnh nhẹ để không cần bẻ đường thành chéo/gấp khúc.
  enforcePedigreeStraight(groups,live,nodeW,nodeH,50);

  // Cập nhật chính vị trí hiển thị tạm thời của mọi card liên quan.
  people.forEach(p=>{
    const el=canvas.querySelector(`[data-card-id="${p.id}"]`);
    const pos=live[p.id];
    if(!el||!pos)return;
    const baseX=parseFloat(el.style.left)||0,baseY=parseFloat(el.style.top)||0;
    const tx=(pos.x-baseX),ty=(pos.y-baseY);
    el.style.transform=`translate(${tx}px,${ty}px)`;
  });

  svg.innerHTML='';
  const line=(x1,y1,x2,y2,cls)=>{
    const l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',Math.round(x1));l.setAttribute('y1',Math.round(y1));
    l.setAttribute('x2',Math.round(x2));l.setAttribute('y2',Math.round(y2));l.setAttribute('class',cls);
    svg.appendChild(l);return l;
  };
  const centerX=id=>live[id].x+nodeW/2;
  const topY=id=>live[id].y;
  const bottomY=id=>live[id].y+nodeH;

  // ① Vợ/chồng: bắt buộc một đường ngang.
  for(const g of groups){
    if(g.ids.length!==2)continue;
    const a=live[g.ids[0]],b=live[g.ids[1]];
    const leftId=a.x<=b.x?g.ids[0]:g.ids[1],rightId=leftId===g.ids[0]?g.ids[1]:g.ids[0];
    const left=live[leftId],right=live[rightId];
    line(left.x+nodeW,left.y+nodeH/2,right.x,right.y+nodeH/2,'connector-spouse');
  }

  // ② Cha/mẹ -> con: tuyệt đối không route gấp/chéo.
  for(const pg of groups){
    const children=pg.children.filter(c=>live[c.childId]);
    if(!children.length)continue;
    children.sort((a,b)=>centerX(a.childId)-centerX(b.childId));
    const parentJoinX=pg.ids.length===2?(centerX(pg.ids[0])+centerX(pg.ids[1]))/2:centerX(pg.ids[0]);
    const parentBottom=Math.max(...pg.ids.map(bottomY));
    const childTop=Math.min(...children.map(c=>topY(c.childId)));
    if(children.length===1){
      line(parentJoinX,parentBottom,parentJoinX,childTop,'connector-parent');
      continue;
    }
    const barY=Math.round(parentBottom+(childTop-parentBottom)*0.5);
    const firstX=centerX(children[0].childId),lastX=centerX(children[children.length-1].childId);
    line(parentJoinX,parentBottom,parentJoinX,barY,'connector-parent');
    line(firstX,barY,lastX,barY,'connector-siblings');
    children.forEach(c=>line(centerX(c.childId),barY,centerX(c.childId),topY(c.childId),'connector-parent'));
  }
}

function applyTreeTransform(){
  const canvas=document.querySelector("#treeCanvas");
  if(canvas) canvas.style.transform=`translate(${drag.l}px,${drag.t}px) scale(${scale})`;
}

function renderTree(){
  const canvas=$("#treeCanvas");
  if(!canvas)return;
  canvas.innerHTML="";
  people=sanitizePeople(people);
  if(!people.length){people=cloneSample();save();}
  if(selectedId&&!get(selectedId))selectedId="";

  /*
   * LAYOUT PHẢ HỆ — phiên bản nhiều-cha/mẹ, nhưng mỗi người chỉ xuất hiện 1 lần.
   *
   * Quy tắc:
   * 1) A ─ B = vợ/chồng.
   * 2) Cha/mẹ -> con dựa trên TỪNG NGƯỜI CON, không dựa trên cả family unit.
   * 3) Một family unit (ví dụ Ba–Mẹ) có thể nhận liên kết từ hai nhánh khác nhau:
   *      Ông bà nội -> Ba      Ông bà ngoại -> Mẹ
   *    trong khi Ba–Mẹ chỉ được vẽ 1 lần.
   * 4) Anh/chị/em cùng một nhóm cha mẹ được xếp theo birthOrder và co khoảng cách
   *    khi số lượng tăng.
   * 5) Các hàng được pack theo card thật, không lấy chiều rộng subtree làm khoảng cách
   *    giữa các root; vì vậy các nhánh nội/ngoại không bị kéo ra một khoảng trống lớn.
   */
  const mobile=window.innerWidth<=700;
  const NODE_W=mobile?128:160;
  const NODE_H=mobile?66:78;
  const COUPLE_GAP=mobile?14:24;
  const GROUP_GAP=mobile?12:18;
  const ROW_H=mobile?112:126;
  const PAD=mobile?18:34;
  const MIN_WIDTH=mobile?Math.max(320,(document.querySelector("#treeViewport")?.clientWidth||380)-8):760;
  const MIN_COUPLE_CENTER=NODE_W+COUPLE_GAP;

  const groups=[];
  const groupByPerson=new Map();
  const used=new Set();
  const indexOf=id=>people.findIndex(p=>p.id===id);
  const keyOf=(a,b)=>[a,b].filter(Boolean).sort().join("|");

  // Mỗi cặp vợ/chồng là một group, nhưng group KHÔNG còn là một "child node".
  // Một người trong group có thể là con của nhánh nội, người còn lại là con của nhánh ngoại.
  for(const p of people){
    if(used.has(p.id))continue;
    const spouse=(p.spouse&&get(p.spouse)&&p.spouse!==p.id)?get(p.spouse):null;
    const ids=spouse?[p.id,spouse.id]:[p.id];
    const g={key:keyOf(...ids),ids,children:[],parents:new Set(),depth:0,x:0,w:NODE_W,ownX:0};
    groups.push(g);
    ids.forEach(id=>{used.add(id);groupByPerson.set(id,g)});
  }

  const addChild=(parentGroup,childGroup,childId)=>{
    if(!parentGroup||!childGroup||parentGroup===childGroup)return;
    if(parentGroup.children.some(c=>c.childId===childId))return;
    parentGroup.children.push({group:childGroup,childId});
    childGroup.parents.add(parentGroup);
  };

  // Người chính để định hướng hai nhánh họ hàng vào nhau.
  const mePerson=people.find(p=>normalizeText(p.nickname||"")==="toi"||normalizeText(p.name||"")==="toi")||get("me");
  const focusMotherId=mePerson?.mother||"";
  const focusFatherId=mePerson?.father||"";
  const focusCoupleGroup=(focusMotherId&&focusFatherId)?groupByPerson.get(focusMotherId):null;

  // Gắn quan hệ cha/mẹ theo TỪNG CÁ NHÂN. Đây là phần quan trọng giúp Ba/Mẹ
  // cùng tồn tại trong một cặp nhưng vẫn giữ được hai nhánh nội/ngoại riêng.
  for(const child of people){
    const childGroup=groupByPerson.get(child.id);
    const parentIds=[child.father,child.mother].filter(id=>id&&get(id));
    const seenParents=new Set();
    for(const pid of parentIds){
      const pg=groupByPerson.get(pid);
      if(!pg||seenParents.has(pg))continue;
      seenParents.add(pg);
      addChild(pg,childGroup,child.id);
    }
  }

  const sortChildren=g=>{
    g.children.sort((a,b)=>{
      const pa=get(a.childId),pb=get(b.childId);
      const ao=Number(pa?.birthOrder)||Number.MAX_SAFE_INTEGER;
      const bo=Number(pb?.birthOrder)||Number.MAX_SAFE_INTEGER;
      if(ao!==bo)return ao-bo;
      return indexOf(a.childId)-indexOf(b.childId);
    });
  };
  groups.forEach(sortChildren);

  // Độ sâu là theo số tầng tổ tiên. Một group có thể có 2 parent group.
  const roots=groups.filter(g=>g.parents.size===0);
  groups.forEach(g=>g.depth=0);
  for(let pass=0;pass<groups.length*2;pass++){
    let changed=false;
    for(const g of groups){
      if(!g.parents.size)continue;
      const nd=1+Math.max(...[...g.parents].map(p=>p.depth));
      if(nd!==g.depth){g.depth=nd;changed=true;}
    }
    if(!changed)break;
  }

  const coupleGap=g=>g.ids.length===2?COUPLE_GAP:0;
  const groupWidth=g=>g.ids.length===2?NODE_W*2+coupleGap(g):NODE_W;

  // Tính x mục tiêu của con theo từng parent group.
  // Mỗi parent group có một "sibship slot" riêng, nên các anh/chị/em vẫn compact.
  const positions={};
  const rowGroups=new Map();
  groups.forEach(g=>{
    if(!rowGroups.has(g.depth))rowGroups.set(g.depth,[]);
    rowGroups.get(g.depth).push(g);
  });

  // Root positions: luôn pack gọn theo card thật, không theo tổng subtree.
  let rootCursor=PAD;
  roots.forEach(g=>{
    const w=groupWidth(g);
    g.ownX=rootCursor;
    rootCursor+=w+GROUP_GAP;
  });
  const setGroupPositions=(g,x,y)=>{
    const gap=coupleGap(g);
    positions[g.ids[0]]={x,y};
    g.ownX=x;
    if(g.ids.length===2)positions[g.ids[1]]={x:x+NODE_W+gap,y};
  };

  function inwardBloodBranch(seedId){
    // Chỉ lấy họ hàng huyết thống: đi lên qua cha/mẹ và gom các con của tổ tiên,
    // tuyệt đối không đi qua cạnh vợ/chồng để hai nhà Nội/Ngoại không nhập làm một.
    const ids=new Set();
    let frontier=[seedId];
    const ancestorSeen=new Set();
    for(let depth=0;depth<12 && frontier.length;depth++){
      const next=[];
      frontier.forEach(id=>{
        if(!id||ancestorSeen.has(id))return;
        ancestorSeen.add(id);ids.add(id);
        const p=get(id);
        if(!p)return;
        [p.father,p.mother].filter(Boolean).forEach(pid=>{
          if(!ancestorSeen.has(pid))next.push(pid);
        });
      });
      frontier=next;
    }
    // Với mọi tổ tiên đã tìm được, thêm tất cả con của họ (anh/chị/em cùng nhánh).
    for(const anc of [...ancestorSeen]) childrenOf(anc).forEach(c=>ids.add(c.id));
    return ids;
  }

  function alignInwardBranches(){
    if(!focusMotherId||!focusFatherId||focusMotherId===focusFatherId)return;
    const motherPos=positions[focusMotherId],fatherPos=positions[focusFatherId];
    if(!motherPos||!fatherPos)return;
    const maternalIds=inwardBloodBranch(focusMotherId);
    const paternalIds=inwardBloodBranch(focusFatherId);
    const mCenter=motherPos.x+NODE_W/2, fCenter=fatherPos.x+NODE_W/2;
    const currentMid=(mCenter+fCenter)/2;
    // Ba/Mẹ sát nhau ở giữa; khoảng hở nhỏ nhưng có thêm chút đệm khi hai nhà rất đông.
    const maternalCount=Math.max(0,maternalIds.size-1), paternalCount=Math.max(0,paternalIds.size-1);
    const coupleGap=Math.min(70, Math.max(COUPLE_GAP, 18+Math.min(40,(maternalCount+paternalCount)*1.5)));
    const desiredM=currentMid-(NODE_W+coupleGap)/2;
    const desiredF=currentMid+(NODE_W+coupleGap)/2;
    const dm=desiredM-mCenter, df=desiredF-fCenter;
    maternalIds.forEach(id=>{if(positions[id])positions[id].x+=dm});
    paternalIds.forEach(id=>{if(positions[id])positions[id].x+=df});
  }
  for(const g of roots)setGroupPositions(g,g.ownX,45+g.depth*ROW_H);

  const personCenter=id=>positions[id]?positions[id].x+NODE_W/2:null;
  const groupCenter=g=>{
    const vals=g.ids.map(personCenter).filter(v=>v!=null);
    if(!vals.length)return null;
    return (Math.min(...vals)+Math.max(...vals))/2;
  };

  function makeParentTargets(pg){
    const out=new Map();
    const children=pg.children.slice().sort((a,b)=>{
      // Với cặp Ba–Mẹ: Mẹ là người con hướng vào giữa của nhánh Ngoại,
      // Ba là người con hướng vào giữa của nhánh Nội.
      if(focusMotherId&&a.childId===focusMotherId && b.childId!==focusMotherId) return 1;
      if(focusMotherId&&b.childId===focusMotherId && a.childId!==focusMotherId) return -1;
      if(focusFatherId&&a.childId===focusFatherId && b.childId!==focusFatherId) return -1;
      if(focusFatherId&&b.childId===focusFatherId && a.childId!==focusFatherId) return 1;
      const ao=Number(get(a.childId)?.birthOrder)||Number.MAX_SAFE_INTEGER;
      const bo=Number(get(b.childId)?.birthOrder)||Number.MAX_SAFE_INTEGER;
      if(ao!==bo)return ao-bo;
      return indexOf(a.childId)-indexOf(b.childId);
    });
    if(!children.length)return out;
    const widths=children.map(c=>groupWidth(c.group));
    const total=widths.reduce((a,b)=>a+b,0)+(widths.length-1)*GROUP_GAP;
    const pc=groupCenter(pg);
    if(pc==null)return out;
    let left=pc-total/2;
    children.forEach((c,i)=>{
      const w=widths[i];
      const cg=c.group;
      const childId=c.childId;
      const inGroupIndex=cg.ids.indexOf(childId);
      const anchorOffset=inGroupIndex===1?(NODE_W+coupleGap(cg)+NODE_W/2):(NODE_W/2);
      out.set(childId,left+anchorOffset);
      left+=w+GROUP_GAP;
    });
    return out;
  }

  // X mục tiêu cho từng cá nhân ở mỗi tầng. Với Ba-Mẹ, Ba có thể nhận target từ
  // ông bà nội còn Mẹ nhận target từ ông bà ngoại.
  for(let depth=1;depth<=Math.max(0,...groups.map(g=>g.depth));depth++){
    const row=rowGroups.get(depth)||[];
    const targetByPerson=new Map();
    for(const pg of (rowGroups.get(depth-1)||[])){
      const targets=makeParentTargets(pg);
      targets.forEach((x,id)=>targetByPerson.set(id,x));
    }

    // Một số group có parent ở tầng cao hơn do dữ liệu phức tạp; lấy thêm target từ mọi parent đã có tọa độ.
    for(const g of row){
      for(const pg of g.parents){
        if(!groupCenter(pg))continue;
        const direct=makeParentTargets(pg);
        for(const id of g.ids){
          if(direct.has(id))targetByPerson.set(id,direct.get(id));
        }
      }
    }

    const placed=[];
    for(const g of row){
      const y=45+g.depth*ROW_H;
      const ids=g.ids;
      const t1=targetByPerson.get(ids[0]);
      const t2=ids.length===2?targetByPerson.get(ids[1]):null;
      let x;
      if(ids.length===1){
        x=Number.isFinite(t1)?t1-NODE_W/2:PAD;
      }else if(Number.isFinite(t1)&&Number.isFinite(t2)){
        // Ba/Mẹ hoặc bất kỳ cặp nào có hai nhánh cha mẹ khác nhau:
        // giữ mỗi người gần đúng nhánh của họ, chỉ nới cặp khi cần.
        let a=t1-NODE_W/2;
        let b=t2-NODE_W/2;
        if(b<a+MIN_COUPLE_CENTER)b=a+MIN_COUPLE_CENTER;
        x=a;
        g._desiredSecondX=b;
      }else if(Number.isFinite(t1)){
        x=t1-NODE_W/2;
        g._anchorIndex=0;
      }else if(Number.isFinite(t2)){
        x=t2-NODE_W/2-NODE_W-COUPLE_GAP;
        g._anchorIndex=1;
      }else{
        x=PAD+(placed.length?(placed[placed.length-1].right+GROUP_GAP):0);
      }

      if(ids.length===2 && Number.isFinite(g._desiredSecondX)){
        positions[ids[0]]={x,y};
        positions[ids[1]]={x:g._desiredSecondX,y};
      }else{
        setGroupPositions(g,x,y);
      }
      placed.push({g,left:Math.min(...g.ids.map(id=>positions[id].x)),right:Math.max(...g.ids.map(id=>positions[id].x+NODE_W))});
    }

    // Pack hàng hiện tại: co khoảng cách giữa anh/chị/em trước khi nới nhánh lớn.
    // Thứ tự ưu tiên theo vị trí mục tiêu để giảm giao cắt.
    row.sort((a,b)=>{
      const ca=groupCenter(a)??0,cb=groupCenter(b)??0;
      return ca-cb;
    });
    let cursor=PAD;
    for(const g of row){
      const left=Math.min(...g.ids.map(id=>positions[id].x));
      const shift=Math.max(0,cursor-left);
      if(Math.abs(shift)>0.01){
        g.ids.forEach(id=>positions[id].x+=shift);
      }
      const right=Math.max(...g.ids.map(id=>positions[id].x+NODE_W));
      cursor=right+GROUP_GAP;
    }
  }

  // Vị trí thủ công có ưu tiên cao nhất. Chỉ x/y của người đó thay đổi;
  // quan hệ và các node còn lại không bị nhân bản.
  for(const g of groups){
    for(const id of g.ids){
      const manual=manualPositions[`person:${id}`];
      if(!manual||!positions[id])continue;
      if(Number.isFinite(Number(manual.x)))positions[id].x=Number(manual.x);
      if(Number.isFinite(Number(manual.y)))positions[id].y=Number(manual.y);
    }
  }

  // Hai nhà Nội/Ngoại hướng vào nhau quanh cặp Mẹ–Ba trước khi ép connector thẳng.
  alignInwardBranches();

  // Sau khi áp dụng vị trí thủ công, vẫn phải giữ luật đường thẳng của phả hệ.
  enforcePedigreeStraight(groups,positions,NODE_W,NODE_H,80);
  syncManualPositionsFromLayout(positions,manualPositions);

  // Dịch sơ đồ để không cắt card ở mép trái.
  const allPos=Object.values(positions);
  if(allPos.length){
    const minX=Math.min(...allPos.map(p=>p.x));
    if(minX<PAD){const dx=PAD-minX;allPos.forEach(p=>p.x+=dx);}
  }

  const maxRight=Math.max(...Object.values(positions).map(p=>p.x+NODE_W),PAD+MIN_WIDTH);
  const maxDepth=Math.max(0,...groups.map(g=>g.depth));
  const canvasWidth=Math.max(MIN_WIDTH,maxRight+PAD);
  const canvasHeight=(maxDepth+1)*ROW_H+150;
  canvas.style.width=canvasWidth+"px";
  canvas.style.height=canvasHeight+"px";

  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("width",canvasWidth);svg.setAttribute("height",canvasHeight);
  svg.setAttribute("viewBox",`0 0 ${canvasWidth} ${canvasHeight}`);svg.setAttribute("class","family-connectors");
  canvas.appendChild(svg);

  const line=(x1,y1,x2,y2,cls="connector-family",meta={})=>{
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",Math.round(x1));l.setAttribute("y1",Math.round(y1));
    l.setAttribute("x2",Math.round(x2));l.setAttribute("y2",Math.round(y2));
    l.setAttribute("class",cls);
    if(meta.a)l.dataset.a=JSON.stringify(meta.a);if(meta.b)l.dataset.b=JSON.stringify(meta.b);
    svg.appendChild(l);return l;
  };
  // Connector đã được căn thẳng ngay từ layout: không có router gấp/chéo.
  const centerX=id=>positions[id].x+NODE_W/2;
  const topY=id=>positions[id].y;
  const bottomY=id=>positions[id].y+NODE_H;

  // ① Vợ/chồng
  for(const g of groups){
    if(g.ids.length!==2)continue;
    const a=positions[g.ids[0]],b=positions[g.ids[1]];
    const left=a.x<=b.x?a:b,right=a.x<=b.x?b:a;
    const leftId=left===a?g.ids[0]:g.ids[1], rightId=right===b?g.ids[1]:g.ids[0];
    line(left.x+NODE_W,left.y+NODE_H/2,right.x,right.y+NODE_H/2,"connector-spouse",{a:[leftId],b:[rightId]});
  }

  // ② Cha/mẹ -> nhóm con: chỉ vẽ các đoạn thẳng đã được layout căn trục.
  for(const pg of groups){
    const children=pg.children.filter(c=>positions[c.childId]);
    if(!children.length)continue;
    const ordered=children.slice().sort((a,b)=>centerX(a.childId)-centerX(b.childId));
    const parentJoinX=pg.ids.length===2?(centerX(pg.ids[0])+centerX(pg.ids[1]))/2:centerX(pg.ids[0]);
    const parentBottom=Math.max(...pg.ids.map(bottomY));
    const childTop=Math.min(...ordered.map(c=>topY(c.childId)));
    if(ordered.length===1){
      line(parentJoinX,parentBottom,parentJoinX,childTop,"connector-parent",{a:pg.ids,b:[ordered[0].childId]});
      continue;
    }
    const barY=Math.round(parentBottom+(childTop-parentBottom)*0.5);
    const firstX=centerX(ordered[0].childId),lastX=centerX(ordered[ordered.length-1].childId);
    line(parentJoinX,parentBottom,parentJoinX,barY,"connector-parent",{a:pg.ids,b:ordered.map(c=>c.childId)});
    line(firstX,barY,lastX,barY,"connector-siblings",{a:ordered.map(c=>c.childId),b:ordered.map(c=>c.childId)});
    ordered.forEach(c=>line(centerX(c.childId),barY,centerX(c.childId),topY(c.childId),"connector-parent",{a:[c.childId],b:[c.childId]}));
  }

  // ③ Cards
  people.forEach(p=>{
    const pos=positions[p.id];
    if(!pos)return;
    const el=document.createElement("div");
    el.className="tree-card"+(p.id===selectedId?" selected":"")+(positionMode?" position-active":"");
    el.style.left=pos.x+"px";el.style.top=pos.y+"px";
    el.innerHTML=`<div class="avatar">${avatar(p)}</div><div><strong>${esc(p.nickname||p.name)}</strong><small>${esc(p.name)}${p.birth?` • ${p.birth}`:""}</small></div>`;

    let downX=0,downY=0,moved=false;
    const clearHold=()=>{if(positionHoldTimer){clearTimeout(positionHoldTimer);positionHoldTimer=null}};
    const isTouchLike=()=>window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth<=700;
    const toggleSelection=()=>{
      if(positionSelection.has(p.id))positionSelection.delete(p.id);else positionSelection.add(p.id);
      selectedId=p.id;renderPositionSelection();
    };
    el.addEventListener("pointerdown",e=>{
      if(!positionMode)return;
      e.stopPropagation();downX=e.clientX;downY=e.clientY;moved=false;el.setPointerCapture?.(e.pointerId);
      if(!isTouchLike()&&(e.ctrlKey||e.metaKey)){clearHold();toggleSelection();return;}
      if(positionSelection.has(p.id)){activePositionDrag={pointerId:e.pointerId,ids:[...positionSelection],startX:e.clientX,startY:e.clientY,dx:0,dy:0};updateSelectionFrame();return;}
      clearHold();
      positionHoldTimer=setTimeout(()=>{positionHoldTimer=null;positionSelection.add(p.id);selectedId=p.id;renderPositionSelection();},isTouchLike()?280:360);
    });
    el.addEventListener("pointermove",e=>{
      if(!positionMode)return;
      const dx=e.clientX-downX,dy=e.clientY-downY;
      if(Math.abs(dx)>6||Math.abs(dy)>6){moved=true;clearHold();}
      if(!activePositionDrag)return;
      const mx=(e.clientX-activePositionDrag.startX)/scale,my=(e.clientY-activePositionDrag.startY)/scale;
      activePositionDrag.dx=mx;activePositionDrag.dy=my;
      activePositionDrag.ids.forEach(id=>{
        const card=canvas.querySelector(`[data-card-id="${id}"]`);if(card)card.style.transform=`translate(${mx}px,${my}px)`;
      });
      updateSelectionFrame(mx,my);updateDragConnectors(activePositionDrag.ids,mx,my);
    });
    el.addEventListener("pointerup",e=>{
      if(!positionMode)return;
      clearHold();
      if(!activePositionDrag){
        if(!moved&&isTouchLike()&&positionSelection.size&&!positionSelection.has(p.id))toggleSelection();
        return;
      }
      const dragState=activePositionDrag;activePositionDrag=null;
      const dx=Number(dragState.dx||0),dy=Number(dragState.dy||0);
      const valid=isPositionMoveValid(dragState.ids,dx,dy);
      if(valid){
        dragState.ids.forEach(id=>{
          const base=positions[id];
          manualPositions[`person:${id}`]={x:Math.round(base.x+dx),y:Math.round(base.y+dy)};
        });
        safeStorageSet("family-tree-positions-v4",JSON.stringify(manualPositions));save();
      }
      renderTree();
    });
    el.addEventListener("pointercancel",()=>{clearHold();activePositionDrag=null;renderTree()});
    el.addEventListener("click",e=>{
      if(positionMode){e.stopPropagation();return;}
      selectedId=p.id;
      const me=people.find(x=>normalizeText(x.nickname||"")==="toi"||normalizeText(x.name)==="toi")||get("me");
      relationMainId=me?.id||people[0]?.id||"";
      relationTargetId=p.id;
      renderAll(true);
    });
    el.addEventListener("dblclick",e=>{e.stopPropagation();openModal(p.id)});
    el.dataset.cardId=p.id;canvas.appendChild(el);
  });

  applyTreeTransform();
  autoFitTreeView();
}

function autoFitTreeView(){
  const viewport=document.querySelector("#treeViewport");
  const canvas=document.querySelector("#treeCanvas");
  if(!viewport||!canvas||viewHasInteracted)return;
  const mobile=window.innerWidth<=700;
  if(!mobile){scale=Math.max(.85,Math.min(1,scale));drag.l=0;drag.t=0;applyTreeTransform();return;}
  const cw=canvas.offsetWidth||360, ch=canvas.offsetHeight||400;
  const vw=viewport.clientWidth||360, vh=viewport.clientHeight||500;
  const fitW=(vw-24)/cw, fitH=(vh-70)/ch;
  scale=Math.max(.62,Math.min(.86,fitW,fitH));
  const sw=cw*scale, sh=ch*scale;
  drag.l=Math.round((vw-sw)/2);
  drag.t=Math.max(8,Math.round((vh-sh)/2));
  applyTreeTransform();
}

function renderAll(autoRelation=false){renderTree();renderProfile();renderSelects(autoRelation);if(autoRelation)renderAutoRelation();else $("#relationResult").innerHTML="";}

function fillSelect(id, current){
  const el=$(id);el.innerHTML='<option value="">— Không có —</option>'+people.filter(p=>p.id!==current).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
}
let quickParentId="";
function openRelationModal(id){
  quickParentId=id;
  const p=get(id);
  if(!p)return;
  $("#quickAddContext").innerHTML=`<strong>Người được chọn: ${esc(p.nickname||p.name)}</strong><span class="muted" id="quickRolePreview">Vai trò của người mới với ${esc(p.nickname||p.name)}: <b>Con</b></span>`;
  $("#quickName").value="";
  $("#quickRelation").value="child";
  $("#quickBirthOrder").value="";
  $("#siblingOrderWrap").classList.add("hidden");
  $("#relationModal").classList.remove("hidden");
  setTimeout(()=>$("#quickName").focus(),0);
}
function closeRelationModal(){$("#relationModal").classList.add("hidden");quickParentId=""}
function prepareRelatedPerson(){
  const base=get(quickParentId); if(!base)return;
  const rel=$("#quickRelation").value;
  const enteredName=$("#quickName").value.trim();
  const id=crypto.randomUUID();
  const inferredGender=rel==="mother"?"female":rel==="father"?"male":rel==="spouse"?(base.gender==="male"?"female":base.gender==="female"?"male":"other"):"other";
  let p=findPersonByName(enteredName);
  const isNew=!p;
  if(!p){
    p={id,name:enteredName,nickname:"",gender:inferredGender,birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:Number($("#quickBirthOrder").value)||"",notes:"",photo:""};
    people.push(p);
  }
  const baseId=base.id;
  if(rel==="child"){
    const spouse=get(base.spouse);
    if(base.gender==="female") p.mother=baseId;
    else if(base.gender==="male") p.father=baseId;
    if(spouse){
      if(spouse.gender==="female") p.mother=spouse.id;
      else if(spouse.gender==="male") p.father=spouse.id;
    }
    if(!p.birthOrder)p.birthOrder=childrenOf(baseId).filter(x=>x.id!==p.id).length+1;
  }else if(rel==="father"){
    base.father=p.id;
    if(base.mother){p.spouse=base.mother;const m=get(base.mother);if(m)m.spouse=p.id;}
    if(!p.birthOrder)p.birthOrder=1;
  }else if(rel==="mother"){
    base.mother=p.id;
    if(base.father){p.spouse=base.father;const f=get(base.father);if(f)f.spouse=p.id;}
    if(!p.birthOrder)p.birthOrder=1;
  }else if(rel==="spouse"){
    p.spouse=baseId; base.spouse=p.id;
  }else if(rel==="sibling"){
    p.father=base.father||""; p.mother=base.mother||"";
    if(!p.birthOrder)p.birthOrder=(base.birthOrder||siblingsOf(base.id).length+1)+1;
  }
  save();
  closeRelationModal();
  selectedId=p.id;
  if(isNew && !enteredName){
    openModal(p.id);
  }else{
    renderAll(true);
  }
}
function openModal(id=""){
  $("#modal").classList.remove("hidden");$("#personId").value=id;$("#modalTitle").textContent=id?"Chỉnh sửa người":"Thêm người";$("#deletePersonBtn").classList.toggle("hidden",!id);
  const p=id?get(id):{name:"",nickname:"",gender:"male",birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:"",notes:"",photo:""};
  ["name","nickname","birth","job","hometown","birthOrder","notes"].forEach(k=>$("#"+k).value=p[k]??"");
  $("#gender").value=p.gender||"male";fillSelect("#father",id);fillSelect("#mother",id);fillSelect("#spouse",id);
  $("#father").value=p.father||"";$("#mother").value=p.mother||"";$("#spouse").value=p.spouse||"";
  modalPhoto=p.photo||"";
  $("#avatarPreview").innerHTML=avatar(p);
}
function closeModal(){$("#modal").classList.add("hidden")}
$("#addPersonBtn").onclick=()=>{if(selectedId&&get(selectedId))openRelationModal(selectedId);else openModal()};$("#closeModal").onclick=closeModal;$("#cancelBtn").onclick=closeModal;
$("#personForm").onsubmit=e=>{e.preventDefault();const id=$("#personId").value||crypto.randomUUID();let old=get(id);const p={id,name:$("#name").value.trim(),nickname:$("#nickname").value.trim(),gender:$("#gender").value,birth:Number($("#birth").value)||"",job:$("#job").value.trim(),hometown:$("#hometown").value.trim(),father:$("#father").value,mother:$("#mother").value,spouse:$("#spouse").value,birthOrder:Number($("#birthOrder").value)||"",notes:$("#notes").value.trim(),photo:modalPhoto||old?.photo||""};if(!p.name)return;if(old)Object.assign(old,p);else people.push(p);if(p.spouse){const s=get(p.spouse);if(s)s.spouse=p.id}save();selectedId=id;closeModal();renderAll()};
$("#deletePersonBtn").onclick=()=>{const id=$("#personId").value;if(!id)return;if(!confirm("Xóa người này?"))return;people=people.filter(p=>p.id!==id);people.forEach(p=>{if(p.father===id)p.father="";if(p.mother===id)p.mother="";if(p.spouse===id)p.spouse=""});delete manualPositions[`person:${id}`];positionSelection.delete(id);selectedId=people[0]?.id||"";save();closeModal();renderAll()};
$("#photo").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("#avatarPreview").innerHTML=`<img src="${r.result}">`;const id=$("#personId").value;if(id){get(id).photo=r.result;save()}};r.readAsDataURL(f)};
$("#mainPerson").onchange=e=>{relationMainId=e.target.value;renderAutoRelation()};
$("#targetPerson").onchange=e=>{relationTargetId=e.target.value;renderAutoRelation()};
$("#calculateBtn").onclick=()=>renderAutoRelation();
$("#quickAddRelationBtn").onclick=()=>{if(selectedId&&get(selectedId))openRelationModal(selectedId);else alert("Hãy chọn một người trên sơ đồ trước.")};
$("#closeRelationModal").onclick=closeRelationModal;
$("#cancelRelation").onclick=closeRelationModal;
const quickRoleLabels={child:"Con",father:"Cha / Ba",mother:"Mẹ",spouse:"Vợ / Chồng",sibling:"Anh / Chị / Em"};
$("#quickRelation").onchange=e=>{
  $("#siblingOrderWrap").classList.toggle("hidden",e.target.value!=="sibling");
  const base=get(quickParentId),preview=$("#quickRolePreview");
  if(base&&preview)preview.innerHTML=`Vai trò của người mới với ${esc(base.nickname||base.name)}: <b>${esc(quickRoleLabels[e.target.value]||e.target.value)}</b>`;
};
$("#createRelated").onclick=prepareRelatedPerson;
function normalizeText(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}
function findPersonByName(name){
  const n=normalizeText(name);
  return people.find(p=>normalizeText(p.name)===n||normalizeText(p.nickname||"")===n);
}
function makePerson(name,gender="other"){
  name=name.trim().replace(/^[,.;:]+|[,.;:]+$/g,"");
  if(!name)return null;
  let p=findPersonByName(name);
  if(p){
    if(p.gender==="other"&&gender!=="other")p.gender=gender;
    return p;
  }
  p={id:crypto.randomUUID(),name,nickname:"",gender,birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:"",notes:"",photo:""};
  people.push(p); return p;
}
function splitPeople(text){
  return text.replace(/\s+(?:và|&|,|;|\+|\band\b)\s+/gi,"|").split("|").map(x=>x.trim()).filter(Boolean);
}
function detectGender(role){
  const raw=String(role||"").toLowerCase();
  const r=normalizeText(role);
  if(/\b(cu\s+ba|ba\s+noi|ba\s+ngoai|mẹ|me|ma|co|cô|dì|di|chi|chị|em gai|con gai|vo|vợ|me chong|mẹ chồng|bà)\b/.test(raw))return "female";
  if(/\b(cu\s+ong|ong|ông|ba|bo|bố|cha|chu|chú|cau|cậu|anh|em trai|con trai|chong|chồng|bo chong|bố chồng)\b/.test(raw) || /\b(ong|ba|bo|cha|chu|cau|anh|em trai|con trai|chong|bo chong)\b/.test(r))return "male";
  return "other";
}
function setSpouses(a,b){
  if(!a||!b)return;
  a.spouse=b.id; b.spouse=a.id;
  if(a.gender==="other"&&b.gender!=="other")a.gender=b.gender==="male"?"female":"male";
  if(b.gender==="other"&&a.gender!=="other")b.gender=a.gender==="male"?"female":"male";
}
function connectParent(child,parent,gender){
  if(!child||!parent)return;
  if(gender==="female") child.mother=parent.id;
  else if(gender==="male") child.father=parent.id;
}
function connectParents(child,parents){
  parents=parents.filter(Boolean).slice(0,2);
  if(!parents.length)return;
  const female=parents.find(p=>p.gender==="female");
  const male=parents.find(p=>p.gender==="male");
  if(male) child.father=male.id;
  if(female) child.mother=female.id;
  if(parents.length===1){
    if(parents[0].gender==="female") child.mother=parents[0].id;
    else if(parents[0].gender==="male") child.father=parents[0].id;
    else if(!child.father) child.father=parents[0].id;
  }
  if(parents.length===2 && !male && !female){
    child.father=parents[0].id; child.mother=parents[1].id;
  }else if(parents.length===2 && !male){
    const other=parents.find(p=>p!==female); if(other)child.father=other.id;
  }else if(parents.length===2 && !female){
    const other=parents.find(p=>p!==male); if(other)child.mother=other.id;
  }
}
function parseCompactLine(line){
  if(!line.includes(">") && !line.includes("+") && !/^[^\n]+\s*\+\s*[^\n]+$/.test(line)) return {matched:false};
  const clean=line.replace(/→|=>/g,">").trim();
  if(clean.includes(">")){
    const parts=clean.split(">");
    if(parts.length!==2)return {matched:false};
    const left=parts[0].trim(), right=parts[1].trim();
    const parentNames=left.split("+").map(x=>x.trim()).filter(Boolean);
    if(!parentNames.length)return {matched:false};
    const childNames=right.split(/\s*[,;]\s*/).map(x=>x.trim()).filter(Boolean);
    if(!childNames.length)return {matched:false};
    let parents=parentNames.map((name,i)=>makePerson(name,detectGender(name)));
    if(parents.length===2 && parents[0]?.gender==="other" && parents[1]?.gender!=="other")parents[0].gender=parents[1].gender==="male"?"female":"male";
    if(parents.length===2 && parents[1]?.gender==="other" && parents[0]?.gender!=="other")parents[1].gender=parents[0].gender==="male"?"female":"male";
    if(parents.length===2)setSpouses(parents[0],parents[1]);
    childNames.forEach((name,index)=>{
      const child=makePerson(name,detectGender(name));
      connectParents(child,parents);
      if(child && !child.birthOrder)child.birthOrder=index+1;
    });
    return {matched:true};
  }
  if(clean.includes("+")){
    const pair=clean.split("+").map(x=>x.trim()).filter(Boolean);
    if(pair.length===2){
      const a=makePerson(pair[0],detectGender(pair[0]));
      const b=makePerson(pair[1],detectGender(pair[1]));
      setSpouses(a,b);
      return {matched:true};
    }
  }
  return {matched:false};
}
function parseFamilyText(text){
  const statements=text.split(/[\n.!?]+/).map(s=>s.trim()).filter(Boolean);
  let links=0;
  const unresolved=[];
  const beforeCount=people.length;
  for(const raw of statements){
    let line=raw.replace(/^[-*•]\s*/,"").trim();
    const compact=parseCompactLine(line);
    if(compact.matched){
      const beforeLinks=links;
      if(line.includes(">")){
        const pair=line.replace(/→|=>/g,">").split(">");
        const parents=pair[0].split("+").map(x=>findPersonByName(x.trim())).filter(Boolean);
        if(parents.length===2 && parents[0].spouse===parents[1].id)links+=1;
        const childNames=pair[1].split(/\s*[,;]\s*/).map(x=>x.trim()).filter(Boolean);
        links+=childNames.length*parents.length;
      }else links+=1;
      continue;
    }
    let m;
    // "A là con của B và C"
    m=line.match(/^(.+?)\s+(?:la|là)\s+(?:con|con trai|con gai)\s+(?:cua|của)\s+(.+)$/i);
    if(m){
      const child=makePerson(m[1],/con gai/i.test(m[0])?"female":/con trai/i.test(m[0])?"male":"other");
      const parts=splitPeople(m[2]);
      const pars=parts.map((name,i)=>makePerson(name,i===0?"male":"female"));
      connectParents(child,pars); links+=pars.length;
      continue;
    }
    // "Ba/Mẹ của A là B"
    m=line.match(/^(ba|bo|cha|me|mẹ)\s+(?:cua|của)\s+(.+?)\s+(?:la|là)\s+(.+)$/i);
    if(m){
      const gender=/^(me|mẹ)$/i.test(m[1])?"female":"male";
      const child=makePerson(m[2]); const par=makePerson(m[3],gender);
      connectParent(child,par,gender); links++; continue;
    }
    // "A là cha/mẹ của B"
    m=line.match(/^(.+?)\s+(?:la|là)\s+(cha|ba|bo|bố|me|mẹ)\s+(?:cua|của)\s+(.+)$/i);
    if(m){const gender=/me|mẹ/i.test(m[2])?"female":"male";const par=makePerson(m[1],gender),child=makePerson(m[3]);connectParent(child,par,gender);links++;continue;}
    // spouses
    m=line.match(/^(.+?)\s+(?:la|là)\s+(vo|vợ|chong|chồng)\s+(?:cua|của)\s+(.+)$/i);
    if(m){const female=/vo|vợ/i.test(m[2]);const a=makePerson(m[1],female?"female":"male"),b=makePerson(m[3],female?"male":"female");setSpouses(a,b);links++;continue;}
    // siblings
    m=line.match(/^(.+?)\s+(?:la|là)\s+(anh|chi|chị|em)\s+(?:cua|của)\s+(.+)$/i);
    if(m){const a=makePerson(m[1],/chi|chị/i.test(m[2])?"female":/anh/i.test(m[2])?"male":"other"),b=makePerson(m[3]);if(!a.father&&!a.mother){a.father=b.father||"";a.mother=b.mother||""}else{if(!b.father)b.father=a.father;if(!b.mother)b.mother=a.mother}links++;continue;}
    unresolved.push(line);
  }
  save();
  return {created:people.length-beforeCount,links,unresolved};
}
function updateParsePreview(){
  const text=$("#familyText").value.trim();
  $("#parsePreview").innerHTML=text?"<strong>Máy sẽ đọc các câu quan hệ và tự nối người.</strong><span class=\"muted\"> Không cần điền từng ô trong form.</span>":"<span class=\"muted\">Chưa có nội dung.</span>";
}
function openKeyboardModal(){$("#keyboardModal").classList.remove("hidden");updateParsePreview();$("#familyText").focus()}
function closeKeyboardModal(){$("#keyboardModal").classList.add("hidden")}
$("#keyboardBtn").onclick=openKeyboardModal;
$("#closeKeyboardModal").onclick=closeKeyboardModal;
$("#cancelKeyboard").onclick=closeKeyboardModal;
$("#familyText").oninput=updateParsePreview;
$("#buildFamilyBtn").onclick=()=>{const text=$("#familyText").value.trim();if(!text)return;const before=people.length;const result=parseFamilyText(text);const added=people.length-before;closeKeyboardModal();selectedId=people[people.length-1]?.id||selectedId;scale=window.innerWidth<=700?.78:1;drag={...drag,l:0,t:0};viewHasInteracted=false;renderAll();if(result.unresolved.length)alert(`Đã tạo ${added} người và nối ${result.links} quan hệ.\\n\\nCác câu máy chưa hiểu:\\n- ${result.unresolved.join("\\n- ")}\\n\\nBạn có thể viết lại theo mẫu “A là con của B và C”.`);else alert(`Đã tạo/thêm ${added} người và nối ${result.links} quan hệ.`)};

$("#googleBtn").onclick=()=>cloud.user?googleLogout():googleLogin();
$("#positionModeBtn").onclick=()=>{positionMode=!positionMode;clearTimeout(positionHoldTimer);activePositionDrag=null;positionSelection.clear();$("#positionModeBtn").classList.toggle("position-mode",positionMode);$("#positionModeBtn").textContent=positionMode?"✓ Xong vị trí":"↔ Chỉnh vị trí";renderTree();};
$("#resetBtn").onclick=()=>{if(confirm("Khôi phục dữ liệu mẫu?")){people=cloneSample();manualPositions={};safeStorageSet("family-tree-positions-v4","{}");save();selectedId="";renderAll()}};
$("#deleteSelectedBtn").onclick=()=>{
  const ids=positionMode&&positionSelection.size?[...positionSelection]:(selectedId?[selectedId]:[]);
  if(!ids.length)return;
  const names=ids.map(id=>get(id)?.nickname||get(id)?.name).filter(Boolean);
  if(!confirm(`Xóa ${ids.length} người đã chọn${names.length?`\\n\\n${names.join(", ")}`:""}?`))return;
  const doomed=new Set(ids);
  people=people.filter(p=>!doomed.has(p.id));
  people.forEach(p=>{
    if(doomed.has(p.father))p.father="";
    if(doomed.has(p.mother))p.mother="";
    if(doomed.has(p.spouse))p.spouse="";
  });
  ids.forEach(id=>delete manualPositions[`person:${id}`]);
  positionSelection.clear();
  selectedId=people[0]?.id||"";
  save();
  renderAll();
};
const treeToolsToggle=$("#treeToolsToggle"),treeTools=$("#treeTools");
if(treeToolsToggle&&treeTools){
  treeToolsToggle.onclick=()=>{const open=treeTools.classList.toggle("open");treeToolsToggle.setAttribute("aria-expanded",String(open));treeToolsToggle.textContent=open?"×":"⚙";};
}
$("#zoomIn").onclick=()=>{viewHasInteracted=true;scale=Math.min(1.7,scale+.1);renderTree()};$("#zoomOut").onclick=()=>{viewHasInteracted=true;scale=Math.max(.5,scale-.1);renderTree()};$("#zoomReset").onclick=()=>{scale=window.innerWidth<=700?.78:1;drag={...drag,l:0,t:0};viewHasInteracted=false;renderTree()};
$("#treeViewport").addEventListener("wheel",e=>{e.preventDefault();viewHasInteracted=true;scale=Math.max(.5,Math.min(1.7,scale+(e.deltaY<0?.08:-.08)));renderTree()},{passive:false});
$("#treeViewport").addEventListener("pointerdown",e=>{
  if(e.target.closest(".tree-card"))return;
  viewHasInteracted=true;
  drag.on=true;drag.moved=false;drag.cardId="";drag.x=e.clientX;drag.y=e.clientY;drag.sl=drag.l;drag.st=drag.t;
  $("#treeViewport").setPointerCapture?.(e.pointerId);
});
$("#treeViewport").addEventListener("pointermove",e=>{
  if(!drag.on)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)>3||Math.abs(dy)>3)drag.moved=true;
  drag.l=drag.sl+dx;drag.t=drag.st+dy;applyTreeTransform();
});
$("#treeViewport").addEventListener("pointerup",()=>{drag.on=false;drag.cardId=""});
$("#treeViewport").addEventListener("pointercancel",()=>{drag.on=false;drag.cardId=""});
$("#treeViewport").addEventListener("click",e=>{
  if(positionMode)return;
  if(drag.moved)return;
  if(e.target.closest(".tree-card"))return;
  selectedId="";
  renderAll();
});
document.addEventListener("click",e=>{const row=e.target.closest("[data-person]");if(row){selectedId=row.dataset.person;renderAll()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&selectedId&&!$(".modal:not(.hidden)")){selectedId="";renderAll()}});
relationMainId=get("me")?.id||people[0]?.id||""; relationTargetId=selectedId||relationMainId;
initGoogleSync();
try{renderAll(true)}catch(err){
  console.error(err);people=cloneSample();manualPositions={};safeStorageSet(KEY,JSON.stringify(people));safeStorageSet("family-tree-positions-v4","{}");selectedId="";
  try{renderAll()}catch(err2){console.error(err2)}
}
