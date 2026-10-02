const KEY="family-tree-v1";
const sample=[
{id:"me",name:"Tôi",nickname:"Tôi",gender:"male",birth:2006,job:"",hometown:"",father:"dad",mother:"mom",spouse:"",birthOrder:1,notes:"Nhân vật chính"},
{id:"dad",name:"Ba ruột",nickname:"Ba",gender:"male",birth:1978,father:"grandpa",mother:"grandma",spouse:"mom",birthOrder:2,notes:""},
{id:"mom",name:"Mẹ ruột",nickname:"Mẹ",gender:"female",birth:1980,father:"mgrandpa",mother:"mgrandma",spouse:"dad",birthOrder:1,notes:""},
{id:"grandpa",name:"Ông nội",nickname:"Ông nội",gender:"male",birth:1950,father:"ggp",mother:"ggm",spouse:"grandma",birthOrder:1,notes:"Ba của ba ruột"},
{id:"grandma",name:"Bà nội",nickname:"Bà nội",gender:"female",birth:1953,father:"",mother:"",spouse:"grandpa",birthOrder:1,notes:""},
{id:"ggp",name:"Cụ ông nội",nickname:"Cụ ông",gender:"male",birth:1925,father:"",mother:"",spouse:"ggm",birthOrder:1,notes:""},
{id:"ggm",name:"Cụ bà nội",nickname:"Cụ bà",gender:"female",birth:1928,father:"",mother:"",spouse:"ggp",birthOrder:1,notes:""},
{id:"uncle",name:"Chú ruột",nickname:"Chú",gender:"male",birth:1982,father:"grandpa",mother:"grandma",spouse:"auntInLaw",birthOrder:3,notes:"Em trai của ba"},
{id:"auntInLaw",name:"Thím",nickname:"Thím",gender:"female",birth:1984,father:"",mother:"",spouse:"uncle",birthOrder:1,notes:"Vợ của chú"},
{id:"cousin",name:"Anh họ",nickname:"Anh",gender:"male",birth:2004,father:"uncle",mother:"auntInLaw",spouse:"",birthOrder:1,notes:"Con của chú"}
];
let people=load(), selectedId="me", scale=1, drag={on:false,x:0,y:0,l:0,t:0};

function load(){try{return JSON.parse(localStorage.getItem(KEY))||sample}catch{return sample}}
function save(){localStorage.setItem(KEY,JSON.stringify(people))}
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

function renderSelects(){
  const opts=people.map(p=>`<option value="${p.id}">${esc(p.nickname||p.name)}</option>`).join("");
  $("#mainPerson").innerHTML=opts;$("#targetPerson").innerHTML=opts;
  $("#mainPerson").value=selectedId;
  if(!$("#targetPerson").value||$("#targetPerson").value===selectedId) $("#targetPerson").value=people.find(p=>p.id!==selectedId)?.id||selectedId;
}
function renderProfile(){
  const p=get(selectedId);if(!p){$("#profile").innerHTML='<div class="empty">Chưa chọn người.</div>';return}
  const parents=parentsOf(p.id),kids=childrenOf(p.id),siblings=siblingsOf(p.id);
  $("#profile").innerHTML=`<div class="profile">
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
    <button id="editSelected" class="ghost full" style="margin-top:14px">✎ Chỉnh sửa người này</button>
  </div>`;
  $("#editSelected").onclick=()=>openModal(p.id);
}
function personRow(p){return p?`<div class="family-item" data-person="${p.id}"><div class="mini">${avatar(p)}</div><span>${esc(p.name)}</span></div>`:""}
function renderTree(){
  const canvas=$("#treeCanvas");canvas.innerHTML="";
  const center=get(selectedId)||people[0];
  const generations={};
  function add(id,gen){if(!id||!get(id))return;if(!generations[gen])generations[gen]=[];if(!generations[gen].includes(id))generations[gen].push(id)}
  add(center.id,0);
  parentsOf(center.id).forEach(p=>add(p.id,-1));
  parentsOf(center.id).flatMap(par=>parentsOf(par.id)).forEach(p=>add(p.id,-2));
  childrenOf(center.id).forEach(c=>add(c.id,1));
  childrenOf(center.id).flatMap(c=>childrenOf(c.id)).forEach(c=>add(c.id,2));
  siblingsOf(center.id).forEach(s=>add(s.id,0));
  siblingsOf(center.id).flatMap(s=>childrenOf(s.id)).forEach(c=>add(c.id,1));
  const ids=[...new Set(Object.values(generations).flat())];
  const positions={}; const W=210,H=120;
  Object.keys(generations).sort((a,b)=>a-b).forEach(g=>{
    const arr=generations[g], total=arr.length*W;
    const start=Math.max(40,(1000-total)/2);
    arr.forEach((id,i)=>{positions[id]={x:start+i*W,y:(Number(g)+2)*H+40}})
  });
  const lines=[];
  ids.forEach(id=>{
    const p=get(id), from=positions[id];
    [p.father,p.mother].filter(x=>x&&positions[x]).forEach(pid=>lines.push([positions[pid],from]));
  });
  lines.forEach(([a,b])=>{const x1=a.x+90,y1=a.y+44,x2=b.x+90,y2=b.y;const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);const el=document.createElement("div");el.className="connector";el.style.left=x1+"px";el.style.top=y1+"px";el.style.width=len+"px";el.style.transform=`rotate(${ang}rad)`;canvas.appendChild(el)});
  ids.forEach(id=>{
    const p=get(id),pos=positions[id],el=document.createElement("div");el.className="tree-card"+(id===selectedId?" selected":"");el.style.left=pos.x+"px";el.style.top=pos.y+"px";
    el.innerHTML=`<div class="avatar">${avatar(p)}</div><div><strong>${esc(p.nickname||p.name)}</strong><small>${esc(p.name)}${p.birth?` • ${p.birth}`:""}</small></div>`;
    el.onclick=()=>{selectedId=id;renderAll()};el.ondblclick=()=>openModal(id);canvas.appendChild(el);
  });
  canvas.style.transform=`translate(${drag.l}px,${drag.t}px) scale(${scale})`;
}
function renderAll(){renderTree();renderProfile();renderSelects();$("#relationResult").innerHTML="";}

function fillSelect(id, current){
  const el=$(id);el.innerHTML='<option value="">— Không có —</option>'+people.filter(p=>p.id!==current).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
}
function openModal(id=""){
  $("#modal").classList.remove("hidden");$("#personId").value=id;$("#modalTitle").textContent=id?"Chỉnh sửa người":"Thêm người";$("#deletePersonBtn").classList.toggle("hidden",!id);
  const p=id?get(id):{name:"",nickname:"",gender:"male",birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:"",notes:"",photo:""};
  ["name","nickname","birth","job","hometown","birthOrder","notes"].forEach(k=>$("#"+k).value=p[k]??"");
  $("#gender").value=p.gender||"male";fillSelect("#father",id);fillSelect("#mother",id);fillSelect("#spouse",id);
  $("#father").value=p.father||"";$("#mother").value=p.mother||"";$("#spouse").value=p.spouse||"";
  $("#avatarPreview").innerHTML=avatar(p);
}
function closeModal(){$("#modal").classList.add("hidden")}
$("#addPersonBtn").onclick=()=>openModal();$("#closeModal").onclick=closeModal;$("#cancelBtn").onclick=closeModal;
$("#personForm").onsubmit=e=>{e.preventDefault();const id=$("#personId").value||crypto.randomUUID();let old=get(id);const p={id,name:$("#name").value.trim(),nickname:$("#nickname").value.trim(),gender:$("#gender").value,birth:Number($("#birth").value)||"",job:$("#job").value.trim(),hometown:$("#hometown").value.trim(),father:$("#father").value,mother:$("#mother").value,spouse:$("#spouse").value,birthOrder:Number($("#birthOrder").value)||"",notes:$("#notes").value.trim(),photo:old?.photo||""};if(!p.name)return;if(old)Object.assign(old,p);else people.push(p);if(p.spouse){const s=get(p.spouse);if(s)s.spouse=p.id}save();selectedId=id;closeModal();renderAll()};
$("#deletePersonBtn").onclick=()=>{const id=$("#personId").value;if(!id)return;if(!confirm("Xóa người này?"))return;people=people.filter(p=>p.id!==id);people.forEach(p=>{if(p.father===id)p.father="";if(p.mother===id)p.mother="";if(p.spouse===id)p.spouse=""});selectedId=people[0]?.id||"";save();closeModal();renderAll()};
$("#photo").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("#avatarPreview").innerHTML=`<img src="${r.result}">`;const id=$("#personId").value;if(id){get(id).photo=r.result;save()}};r.readAsDataURL(f)};
$("#mainPerson").onchange=e=>{selectedId=e.target.value;renderTree();renderProfile()};
$("#calculateBtn").onclick=()=>{const a=$("#mainPerson").value,b=$("#targetPerson").value,r=relationship(a,b),names=r.path.map(get);$("#relationResult").innerHTML=`<div class="relation-path"><div class="path-title">Đường quan hệ</div><div class="path">${names.map((p,i)=>`<span>${esc(p.nickname||p.name)}</span>${i<names.length-1?"→":""}`).join("")}</div></div><div class="answer"><small>${esc(get(a)?.nickname||get(a)?.name)} gọi ${esc(get(b)?.nickname||get(b)?.name)} là</small><strong>${esc(r.title)}</strong></div>`};
$("#resetBtn").onclick=()=>{if(confirm("Khôi phục dữ liệu mẫu?")){people=JSON.parse(JSON.stringify(sample));save();selectedId="me";renderAll()}};
$("#zoomIn").onclick=()=>{scale=Math.min(1.7,scale+.1);renderTree()};$("#zoomOut").onclick=()=>{scale=Math.max(.55,scale-.1);renderTree()};$("#zoomReset").onclick=()=>{scale=1;drag={...drag,l:0,t:0};renderTree()};
$("#treeViewport").addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(.55,Math.min(1.7,scale+(e.deltaY<0?.08:-.08)));renderTree()},{passive:false});
$("#treeViewport").addEventListener("pointerdown",e=>{if(e.target.closest(".tree-card"))return;drag.on=true;drag.x=e.clientX;drag.y=e.clientY;drag.sl=drag.l;drag.st=drag.t;$("#treeViewport").setPointerCapture(e.pointerId)});
$("#treeViewport").addEventListener("pointermove",e=>{if(!drag.on)return;drag.l=drag.sl+(e.clientX-drag.x);drag.t=drag.st+(e.clientY-drag.y);renderTree()});
$("#treeViewport").addEventListener("pointerup",()=>drag.on=false);
document.addEventListener("click",e=>{const row=e.target.closest("[data-person]");if(row){selectedId=row.dataset.person;renderAll()}});
renderAll();
