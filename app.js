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
let people=load(), selectedId="me", scale=1, drag={on:false,x:0,y:0,l:0,t:0};
let modalPhoto="";
let positionMode=false;
let manualPositions={};
try{manualPositions=JSON.parse(safeStorageGet("family-tree-positions-v1")||"{}")}catch{manualPositions={}}

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
function save(){safeStorageSet(KEY,JSON.stringify(people))}
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
  const opts=people.map(p=>`<option value="${p.id}">${esc(p.nickname||p.name)}</option>`).join("");
  $("#mainPerson").innerHTML=opts;
  $("#targetPerson").innerHTML=opts;

  // Mặc định nhân vật chính là "Tôi". Khi bấm một người trên cây, người đó
  // tự trở thành đối tượng để xem cách xưng hô. Nếu người dùng tự đổi dropdown,
  // kết quả sẽ chỉ thay đổi sau khi bấm nút "Tính cách xưng hô".
  const me=people.find(p=>normalizeText(p.nickname||"")==="toi" || normalizeText(p.name||"")==="toi") || get("me");
  const mainId=me?.id || people[0]?.id || "";
  $("#mainPerson").value=mainId;
  if(autoTarget){
    $("#targetPerson").value=selectedId || (people.find(p=>p.id!==mainId)?.id || mainId);
  }else if(!$("#targetPerson").value){
    $("#targetPerson").value=people.find(p=>p.id!==mainId)?.id || mainId;
  }
}
function renderAutoRelation(){
  const a=$("#mainPerson").value;
  const b=$("#targetPerson").value;
  if(!a||!b){$("#relationResult").innerHTML="";return}
  const r=relationship(a,b), names=r.path.map(get).filter(Boolean);
  $("#relationResult").innerHTML=`<div class="relation-path"><div class="path-title">Đường quan hệ</div><div class="path">${names.map((p,i)=>`<span>${esc(p.nickname||p.name)}</span>${i<names.length-1?"→":""}`).join("")}</div></div><div class="answer"><small>${esc(get(a)?.nickname||get(a)?.name)} gọi ${esc(get(b)?.nickname||get(b)?.name)} là</small><strong>${esc(r.title)}</strong></div>`;
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
  if(!get(selectedId))selectedId=people.find(p=>p.id==="me")?.id||people[0]?.id||"";

  /*
   * BỐ CỤC PHẢ HỆ — quy tắc nối đường:
   * 1. A ─ B là một cặp vợ/chồng.
   * 2. Đường con đi xuống từ TRUNG ĐIỂM của đường vợ/chồng.
   * 3. Nếu có nhiều con: đường dọc của cha mẹ chạm một THANH NGANG
   *    anh/chị/em; từ thanh này mới rẽ dọc xuống từng người con.
   * 4. Nếu chỉ có một con: không tạo thanh anh/chị/em giả; nối thẳng
   *    từ trung điểm cặp cha mẹ xuống người con.
   * 5. Một người có thể vừa là con ở một nhánh vừa là vợ/chồng ở nhánh khác.
   * 6. Thứ tự anh/chị/em ưu tiên birthOrder, sau đó mới đến thứ tự trong dữ liệu.
   */
  const NODE_W=180, NODE_H=88, COUPLE_GAP=42;
  const GROUP_GAP=90, ROW_H=185, PAD=90, MIN_WIDTH=1200;

  const groups=[];
  const groupByPerson=new Map();
  const used=new Set();
  const keyOf=(a,b)=>[a,b].filter(Boolean).sort().join("|");

  // Mỗi cặp vợ/chồng là một "family unit". Người độc thân là một unit riêng.
  for(const p of people){
    if(used.has(p.id))continue;
    const spouse=(p.spouse&&get(p.spouse)&&p.spouse!==p.id)?get(p.spouse):null;
    const ids=spouse?[p.id,spouse.id]:[p.id];
    const anchor=(p.father||p.mother)?p.id:(spouse&&(spouse.father||spouse.mother)?spouse.id:p.id);
    const g={key:keyOf(...ids),ids,anchor,children:[],parent:null,depth:0,x:0,w:0,ownX:0,baseX:0};
    groups.push(g);
    for(const id of ids){used.add(id);groupByPerson.set(id,g);}
  }

  const addChild=(parentGroup,childGroup,childId)=>{
    if(!parentGroup||!childGroup||parentGroup===childGroup)return;
    if(parentGroup.children.some(c=>c.group===childGroup))return;
    parentGroup.children.push({group:childGroup,childId});
    if(!childGroup.parent)childGroup.parent=parentGroup;
  };

  // Gắn mỗi người con vào đúng family unit của cha mẹ.
  for(const child of people){
    const parentIds=[child.father,child.mother].filter(id=>id&&get(id));
    if(!parentIds.length)continue;

    let parentGroup=null;
    if(parentIds.length===2){
      const a=get(parentIds[0]), b=get(parentIds[1]);
      if(a?.spouse===b?.id) parentGroup=groupByPerson.get(a.id);
      else if(b?.spouse===a?.id) parentGroup=groupByPerson.get(b.id);
      else parentGroup=groupByPerson.get(parentIds[0]);
    }else{
      parentGroup=groupByPerson.get(parentIds[0]);
    }
    addChild(parentGroup,groupByPerson.get(child.id),child.id);
  }

  const sortChildren=(g)=>{
    g.children.sort((a,b)=>{
      const pa=get(a.childId), pb=get(b.childId);
      const ao=Number(pa?.birthOrder)||Number.MAX_SAFE_INTEGER;
      const bo=Number(pb?.birthOrder)||Number.MAX_SAFE_INTEGER;
      if(ao!==bo)return ao-bo;
      return people.findIndex(p=>p.id===a.childId)-people.findIndex(p=>p.id===b.childId);
    });
    g.children.forEach(c=>sortChildren(c.group));
  };
  groups.forEach(sortChildren);

  const roots=groups.filter(g=>!g.parent);
  const widthMemo=new Map();
  const calcWidth=(g,stack=new Set())=>{
    if(widthMemo.has(g))return widthMemo.get(g);
    if(stack.has(g))return NODE_W;
    stack.add(g);
    const ownW=g.ids.length===2?NODE_W*2+COUPLE_GAP:NODE_W;
    const kidsW=g.children.length
      ?g.children.reduce((sum,c)=>sum+calcWidth(c.group,stack),0)+(g.children.length-1)*GROUP_GAP
      :0;
    stack.delete(g);
    const w=Math.max(ownW,kidsW);
    widthMemo.set(g,w);
    return w;
  };
  groups.forEach(g=>calcWidth(g));

  const placed=new Set();
  const place=(g,x,depth)=>{
    if(placed.has(g))return;
    placed.add(g);
    g.depth=depth;
    g.x=x;
    g.w=calcWidth(g);
    const ownW=g.ids.length===2?NODE_W*2+COUPLE_GAP:NODE_W;
    g.ownX=x+(g.w-ownW)/2;
    if(g.children.length){
      const total=g.children.reduce((sum,c)=>sum+calcWidth(c.group),0)+(g.children.length-1)*GROUP_GAP;
      let cx=x+(g.w-total)/2;
      for(const c of g.children){
        place(c.group,cx,depth+1);
        cx+=calcWidth(c.group)+GROUP_GAP;
      }
    }
  };

  let cursor=PAD;
  roots.forEach(r=>{
    place(r,cursor,0);
    cursor+=calcWidth(r)+GROUP_GAP*1.5;
  });
  groups.forEach(g=>{
    if(!placed.has(g)){
      place(g,cursor,0);
      cursor+=calcWidth(g)+GROUP_GAP;
    }
  });

  const positions={};
  for(const g of groups){
    const y=45+g.depth*ROW_H;
    const saved=(g.anchor&&manualPositions[g.anchor])||null;
    const base=Number.isFinite(Number(saved?.x))?Number(saved.x):g.ownX;
    g.baseX=base;

    positions[g.ids[0]]={x:base,y};
    if(g.ids.length===2){
      positions[g.ids[1]]={x:base+NODE_W+COUPLE_GAP,y};
    }
  }

  // CĂN CẶP CHA/MẸ THEO ĐÚNG SIBSHIP BAR:
  // Người phối ngẫu của một đứa con KHÔNG được làm lệch tâm của
  // thế hệ cha mẹ. Chỉ tâm của các "người con" (childId) mới quyết định
  // vị trí thanh anh/chị/em và trung điểm nối từ cặp cha mẹ xuống.
  // Ví dụ: Ông nội─Bà nội và Chú─Thím là hai cặp con; thanh anh em
  // chỉ nối tâm Ông nội ↔ tâm Chú, không tính Bà nội/Thím vào hai đầu.
  // Sau khi các con đã được đặt, dịch cả family unit của cha mẹ để
  // trung điểm cặp cha mẹ trùng với trung điểm nhóm con.
  const centerOfGroup=g=>{
    const entries=g.children.filter(c=>positions[c.childId]);
    if(!entries.length)return null;
    const xs=entries.map(c=>positions[c.childId].x+NODE_W/2);
    return (Math.min(...xs)+Math.max(...xs))/2;
  };
  const shiftGroup=(g,dx)=>{
    if(!Number.isFinite(dx)||Math.abs(dx)<0.01)return;
    g.baseX+=dx;
    for(const id of g.ids)positions[id].x+=dx;
  };
  // Làm từ thế hệ thấp lên để mỗi cặp được căn theo chính các con của nó.
  [...groups].sort((a,b)=>b.depth-a.depth).forEach(g=>{
    if(!g.children.length)return;
    const childCenter=centerOfGroup(g);
    if(childCenter==null)return;
    const ownCenter=g.ids.length===2
      ?(positions[g.ids[0]].x+NODE_W/2+positions[g.ids[1]].x+NODE_W/2)/2
      :positions[g.ids[0]].x+NODE_W/2;
    shiftGroup(g,childCenter-ownCenter);
  });

  const maxDepth=Math.max(0,...groups.map(g=>g.depth));
  const canvasWidth=Math.max(MIN_WIDTH,cursor+PAD);
  const canvasHeight=(maxDepth+1)*ROW_H+150;
  canvas.style.width=canvasWidth+"px";
  canvas.style.height=canvasHeight+"px";

  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("width",canvasWidth);
  svg.setAttribute("height",canvasHeight);
  svg.setAttribute("viewBox",`0 0 ${canvasWidth} ${canvasHeight}`);
  svg.setAttribute("class","family-connectors");
  canvas.appendChild(svg);

  const line=(x1,y1,x2,y2,cls="connector-family")=>{
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",Math.round(x1));
    l.setAttribute("y1",Math.round(y1));
    l.setAttribute("x2",Math.round(x2));
    l.setAttribute("y2",Math.round(y2));
    l.setAttribute("class",cls);
    svg.appendChild(l);
  };
  const centerX=id=>positions[id].x+NODE_W/2;
  const topY=id=>positions[id].y;
  const bottomY=id=>positions[id].y+NODE_H;

  // ① Vợ/chồng: chỉ nối đúng hai người trong cùng một family unit.
  for(const g of groups){
    if(g.ids.length!==2)continue;
    const a=positions[g.ids[0]], b=positions[g.ids[1]];
    const left=a.x<=b.x?a:b;
    const right=a.x<=b.x?b:a;
    line(left.x+NODE_W,left.y+NODE_H/2,right.x,right.y+NODE_H/2,"connector-spouse");
  }

  // ② Cha/mẹ -> nhóm con.
  //    Nhiều con: midpoint cha mẹ -> thanh anh/chị/em -> từng con.
  //    Một con: midpoint cha mẹ -> thẳng người con.
  for(const pg of groups){
    const childEntries=pg.children.filter(c=>positions[c.childId]);
    if(!childEntries.length)continue;

    const parentJoinX=pg.ids.length===2
      ?(centerX(pg.ids[0])+centerX(pg.ids[1]))/2
      :centerX(pg.ids[0]);
    const parentBottom=Math.max(...pg.ids.map(bottomY));

    const children=childEntries
      .map(c=>c.childId)
      .sort((a,b)=>centerX(a)-centerX(b));
    const childTop=Math.min(...children.map(topY));

    if(children.length===1){
      // Không có thanh ngang giả khi chỉ có một con.
      line(parentJoinX,parentBottom,parentJoinX,childTop,"connector-parent");
      continue;
    }

    // Thanh anh/chị/em nằm giữa cha mẹ và hàng con.
    const barY=Math.round(parentBottom+(childTop-parentBottom)/2);
    const firstX=centerX(children[0]);
    const lastX=centerX(children[children.length-1]);

    line(parentJoinX,parentBottom,parentJoinX,barY,"connector-parent");
    line(firstX,barY,lastX,barY,"connector-siblings");
    children.forEach(id=>line(centerX(id),barY,centerX(id),childTop,"connector-parent"));
  }

  // ③ Các cá thể nằm trên cùng hàng được đặt theo unit; một người có thể
  //    đồng thời là con ở nhánh trên và là vợ/chồng ở nhánh hiện tại.
  people.forEach(p=>{
    const pos=positions[p.id];
    if(!pos)return;
    const el=document.createElement("div");
    el.className="tree-card"+(p.id===selectedId?" selected":"")+(positionMode?" position-active":"");
    el.style.left=pos.x+"px";
    el.style.top=pos.y+"px";
    el.innerHTML=`<div class="avatar">${avatar(p)}</div><div><strong>${esc(p.nickname||p.name)}</strong><small>${esc(p.name)}${p.birth?` • ${p.birth}`:""}</small></div>`;

    let downX=0,downY=0,startG=null,startX=0,moved=false;
    el.addEventListener("pointerdown",e=>{
      if(!positionMode)return;
      downX=e.clientX;downY=e.clientY;moved=false;
      startG=groupByPerson.get(p.id);startX=startG?startG.baseX:pos.x;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener("pointermove",e=>{
      if(!positionMode||!startG)return;
      const dx=(e.clientX-downX)/scale;
      if(Math.abs(dx)>5)moved=true;
      el.style.transform=`translateX(${dx}px)`;
      if(startG.ids.length===2){
        const otherId=startG.ids.find(id=>id!==p.id);
        const otherEl=canvas.querySelector?.(`[data-card-id="${otherId}"]`);
        if(otherEl)otherEl.style.transform=`translateX(${dx}px)`;
      }
    });
    el.addEventListener("pointerup",e=>{
      if(!positionMode||!startG)return;
      const dx=(e.clientX-downX)/scale;
      el.style.transform="";
      const g=startG;startG=null;
      if(!moved){selectedId=p.id;renderAll(true);return;}

      const proposed=startX+dx;
      const ownW=g.ids.length===2?NODE_W*2+COUPLE_GAP:NODE_W;
      let valid=Number.isFinite(proposed);
      for(const other of groups){
        if(other===g||other.depth!==g.depth)continue;
        const ox=other.baseX;
        const ow=other.ids.length===2?NODE_W*2+COUPLE_GAP:NODE_W;
        if(proposed<ox+ow+20&&proposed+ownW>ox-20){valid=false;break;}
      }
      if(valid){
        manualPositions[g.anchor]={x:proposed};
      }else{
        delete manualPositions[g.anchor];
      }
      safeStorageSet("family-tree-positions-v1",JSON.stringify(manualPositions));
      renderTree();
    });
    el.addEventListener("pointercancel",()=>{startG=null;el.style.transform="";renderTree()});
    el.addEventListener("click",e=>{
      if(positionMode&&moved){e.stopPropagation();return;}
      selectedId=p.id;
      renderAll(true);
    });
    el.addEventListener("dblclick",e=>{e.stopPropagation();openModal(p.id)});
    el.dataset.cardId=p.id;
    canvas.appendChild(el);
  });

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
  $("#quickAddContext").innerHTML=`<strong>Đang thêm người cho: ${esc(p.nickname||p.name)}</strong><span class="muted">Tên người mới sẽ được đặt vào quan hệ bạn chọn và tự nối vào sơ đồ.</span>`;
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
$("#deletePersonBtn").onclick=()=>{const id=$("#personId").value;if(!id)return;if(!confirm("Xóa người này?"))return;people=people.filter(p=>p.id!==id);people.forEach(p=>{if(p.father===id)p.father="";if(p.mother===id)p.mother="";if(p.spouse===id)p.spouse=""});selectedId=people[0]?.id||"";save();closeModal();renderAll()};
$("#photo").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("#avatarPreview").innerHTML=`<img src="${r.result}">`;const id=$("#personId").value;if(id){get(id).photo=r.result;save()}};r.readAsDataURL(f)};
$("#mainPerson").onchange=e=>{selectedId=e.target.value;renderTree();renderProfile()};
$("#calculateBtn").onclick=()=>{const a=$("#mainPerson").value,b=$("#targetPerson").value,r=relationship(a,b),names=r.path.map(get);$("#relationResult").innerHTML=`<div class="relation-path"><div class="path-title">Đường quan hệ</div><div class="path">${names.map((p,i)=>`<span>${esc(p.nickname||p.name)}</span>${i<names.length-1?"→":""}`).join("")}</div></div><div class="answer"><small>${esc(get(a)?.nickname||get(a)?.name)} gọi ${esc(get(b)?.nickname||get(b)?.name)} là</small><strong>${esc(r.title)}</strong></div>`};
$("#closeRelationModal").onclick=closeRelationModal;
$("#cancelRelation").onclick=closeRelationModal;
$("#quickRelation").onchange=e=>$("#siblingOrderWrap").classList.toggle("hidden",e.target.value!=="sibling");
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
$("#buildFamilyBtn").onclick=()=>{const text=$("#familyText").value.trim();if(!text)return;const before=people.length;const result=parseFamilyText(text);const added=people.length-before;closeKeyboardModal();selectedId=people[people.length-1]?.id||selectedId;scale=1.05;drag={...drag,l:0,t:0};renderAll();if(result.unresolved.length)alert(`Đã tạo ${added} người và nối ${result.links} quan hệ.\\n\\nCác câu máy chưa hiểu:\\n- ${result.unresolved.join("\\n- ")}\\n\\nBạn có thể viết lại theo mẫu “A là con của B và C”.`);else alert(`Đã tạo/thêm ${added} người và nối ${result.links} quan hệ.`)};

$("#positionModeBtn").onclick=()=>{positionMode=!positionMode;$("#positionModeBtn").classList.toggle("position-mode",positionMode);$("#positionModeBtn").textContent=positionMode?"✓ Xong vị trí":"↔ Chỉnh vị trí";renderTree()};
$("#resetBtn").onclick=()=>{if(confirm("Khôi phục dữ liệu mẫu?")){people=cloneSample();manualPositions={};safeStorageSet("family-tree-positions-v1","{}");save();selectedId="me";renderAll()}};
$("#zoomIn").onclick=()=>{scale=Math.min(1.7,scale+.1);renderTree()};$("#zoomOut").onclick=()=>{scale=Math.max(.55,scale-.1);renderTree()};$("#zoomReset").onclick=()=>{scale=1;drag={...drag,l:0,t:0};renderTree()};
$("#treeViewport").addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(.55,Math.min(1.7,scale+(e.deltaY<0?.08:-.08)));renderTree()},{passive:false});
$("#treeViewport").addEventListener("pointerdown",e=>{
  if(e.target.closest(".tree-card"))return;
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
document.addEventListener("click",e=>{const row=e.target.closest("[data-person]");if(row){selectedId=row.dataset.person;renderAll()}});
try{renderAll()}catch(err){
  console.error(err);people=cloneSample();manualPositions={};safeStorageSet(KEY,JSON.stringify(people));safeStorageSet("family-tree-positions-v1","{}");selectedId="me";
  try{renderAll()}catch(err2){console.error(err2)}
}
