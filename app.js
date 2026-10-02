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
let modalPhoto="";

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
  canvas.innerHTML="";
  if(!people.length)return;

  // Một sơ đồ duy nhất, giữ nguyên khung người. Chỉ thay đổi các thanh nối:
  // vợ/chồng = ngang; cha mẹ -> con = dọc; anh/chị/em = cùng một thanh ngang.
  const root=get("me")||people[0];
  const gen=new Map(), queue=[];
  const put=(id,g)=>{
    if(!id||!get(id))return;
    if(!gen.has(id)){gen.set(id,g);queue.push(id);}
  };
  put(root.id,0);
  while(queue.length){
    const id=queue.shift(), g=gen.get(id), p=get(id);
    [p.father,p.mother].filter(Boolean).forEach(x=>put(x,g-1));
    childrenOf(id).forEach(x=>put(x.id,g+1));
    if(p.spouse)put(p.spouse,g);
    siblingsOf(id).forEach(x=>put(x.id,g));
  }
  people.forEach(p=>{if(!gen.has(p.id))put(p.id,0)});

  const rows={};
  gen.forEach((g,id)=>(rows[g]??=[]).push(id));
  const rowKeys=Object.keys(rows).map(Number).sort((a,b)=>a-b);
  const minG=Math.min(...rowKeys), maxG=Math.max(...rowKeys);
  const NODE_W=180, NODE_H=88, COUPLE_GAP=42, GROUP_GAP=72, ROW_H=175, PAD=70;
  const positions={};

  // Gom vợ/chồng thành một cụm, nhưng vẫn giữ nguyên card đẹp hiện tại.
  rowKeys.forEach(g=>{
    const ids=rows[g].slice();
    const used=new Set(), groups=[];
    ids.forEach(id=>{
      if(used.has(id))return;
      const p=get(id), sid=p?.spouse;
      if(sid&&ids.includes(sid)&&!used.has(sid)){
        groups.push([id,sid]); used.add(id); used.add(sid);
      }else{
        groups.push([id]); used.add(id);
      }
    });
    groups.sort((a,b)=>{
      const pa=get(a[0]), pb=get(b[0]);
      return (pa?.birthOrder||99)-(pb?.birthOrder||99);
    });
    rows[g]=groups;
  });

  const groupWidth=gr=>gr.length===2 ? NODE_W*2+COUPLE_GAP : NODE_W;
  const maxRowWidth=Math.max(...rowKeys.map(g=>{
    const gs=rows[g];
    return gs.reduce((sum,gr)=>sum+groupWidth(gr),0)+Math.max(0,gs.length-1)*GROUP_GAP;
  }));
  const canvasWidth=Math.max(1100, maxRowWidth+PAD*2);
  const canvasHeight=(maxG-minG+1)*ROW_H+150;

  rowKeys.forEach(g=>{
    const gs=rows[g];
    const total=gs.reduce((sum,gr)=>sum+groupWidth(gr),0)+Math.max(0,gs.length-1)*GROUP_GAP;
    let x=Math.max(PAD,(canvasWidth-total)/2);
    const y=(g-minG)*ROW_H+45;
    gs.forEach(gr=>{
      if(gr.length===2){
        positions[gr[0]]={x,y};
        positions[gr[1]]={x:NODE_W+COUPLE_GAP+x,y};
        x+=NODE_W*2+COUPLE_GAP+GROUP_GAP;
      }else{
        positions[gr[0]]={x,y};
        x+=NODE_W+GROUP_GAP;
      }
    });
  });

  canvas.style.width=canvasWidth+"px";
  canvas.style.height=canvasHeight+"px";

  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("width",canvasWidth); svg.setAttribute("height",canvasHeight);
  svg.setAttribute("class","family-connectors");
  canvas.appendChild(svg);
  const line=(x1,y1,x2,y2,cls="")=>{
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",x1); l.setAttribute("y1",y1);
    l.setAttribute("x2",x2); l.setAttribute("y2",y2);
    l.setAttribute("class",cls); l.setAttribute("vector-effect","non-scaling-stroke");
    svg.appendChild(l);
    return l;
  };
  const path=(d,cls="")=>{
    const el=document.createElementNS("http://www.w3.org/2000/svg","path");
    el.setAttribute("d",d); el.setAttribute("class",cls);
    el.setAttribute("vector-effect","non-scaling-stroke");
    el.setAttribute("fill","none");
    svg.appendChild(el);
    return el;
  };

  const center=p=>({x:p.x+NODE_W/2,y:p.y+NODE_H/2});
  const top=p=>p.y;
  const bottom=p=>p.y+NODE_H;
  const coupleKey=(a,b)=>[a,b].sort().join("|");
  const doneCouples=new Set();
  const doneSiblingBars=new Set();

  // 1) Vợ/chồng: đường ngang liền, đúng giữa hai khung.
  people.forEach(p=>{
    if(!p.spouse||!positions[p.id]||!positions[p.spouse])return;
    const key=coupleKey(p.id,p.spouse);
    if(doneCouples.has(key))return;
    doneCouples.add(key);
    const a=positions[p.id], b=positions[p.spouse];
    const left=a.x<b.x?a:b, right=a.x<b.x?b:a;
    line(left.x+NODE_W, left.y+NODE_H/2, right.x, right.y+NODE_H/2, "connector-spouse");
  });

  // 2 + 3) Nối cha mẹ -> thanh anh/chị/em -> từng người con.
  // Các đoạn đều bắt đầu/kết thúc ĐÚNG tại mép khung hoặc tại điểm giao,
  // nên nhìn thành một hệ thống đường liền mạch, không có khoảng hở.
  const processedParentGroups=new Set();
  people.forEach(parent=>{
    const spouse=parent.spouse?get(parent.spouse):null;
    const parentIds=spouse&&positions[spouse.id] ? [parent.id,spouse.id] : [parent.id];
    const validParentIds=parentIds.filter(id=>positions[id]);
    if(!validParentIds.length)return;

    const kids=childrenOf(parent.id).filter(k=>positions[k.id]);
    if(!kids.length)return;

    const key=validParentIds.slice().sort().join("|");
    if(processedParentGroups.has(key))return;
    processedParentGroups.add(key);

    // Tâm ngang của cặp vợ/chồng (hoặc cha/mẹ đơn thân).
    const parentXs=validParentIds.map(id=>center(positions[id]).x).sort((a,b)=>a-b);
    const junctionX=parentXs.length===2 ? (parentXs[0]+parentXs[1])/2 : parentXs[0];
    const parentBottom=Math.max(...validParentIds.map(id=>bottom(positions[id])));
    const childTop=Math.min(...kids.map(k=>top(positions[k.id])));

    // Thanh anh/chị/em nằm chính giữa khoảng trống giữa hai thế hệ.
    const siblingY=Math.round(parentBottom+(childTop-parentBottom)/2);
    const childXs=[...new Set(kids.map(k=>center(positions[k.id]).x))].sort((a,b)=>a-b);

    // Đường dọc từ giữa cặp vợ/chồng xuống thanh anh/chị/em.
    // Bắt đầu tại MÉP DƯỚI khung để không bị cảm giác đứt đoạn.
    line(junctionX,parentBottom,junctionX,siblingY,"connector-family");

    // Thanh ngang chung cho toàn bộ anh/chị/em.
    const barLeft=childXs[0], barRight=childXs[childXs.length-1];
    if(barLeft===barRight){
      // Một người con: thanh ngang không cần kéo dài, chỉ cần điểm nối.
      line(junctionX,siblingY,barLeft,siblingY,"connector-family");
    }else{
      line(barLeft,siblingY,barRight,siblingY,"connector-family");
      // Nối điểm dọc của cha mẹ vào thanh ngang nếu nó không nằm đúng đầu thanh.
      if(junctionX<barLeft || junctionX>barRight){
        line(junctionX,siblingY,barLeft===junctionX?barRight:barLeft,siblingY,"connector-family");
      }
    }

    // Mỗi con có một đường dọc liền từ thanh ngang tới MÉP TRÊN khung.
    childXs.forEach(cx=>line(cx,siblingY,cx,childTop,"connector-family"));
  });

  // Trường hợp chỉ biết một cha/mẹ và người đó không có spouse.
  people.forEach(child=>{
    if(!positions[child.id])return;
    const parents=[child.father,child.mother].filter(id=>id&&get(id)&&positions[id]);
    if(parents.length!==1)return;
    const parent=get(parents[0]);
    if(parent.spouse&&get(parent.spouse)&&positions[parent.spouse])return;
    const pp=positions[parent.id], cp=positions[child.id];
    const px=center(pp).x, py=bottom(pp);
    const cx=center(cp).x, cy=top(cp);
    const mid=Math.round(py+(cy-py)/2);
    line(px,py,px,mid,"connector-family");
    line(Math.min(px,cx),mid,Math.max(px,cx),mid,"connector-family");
    line(cx,mid,cx,cy,"connector-family");
  });

  // Card người: giữ nguyên giao diện đẹp, avatar, tên và thao tác chọn/sửa.
  people.forEach(p=>{
    const pos=positions[p.id]; if(!pos)return;
    const id=p.id;
    const el=document.createElement("div");
    el.className="tree-card"+(id===selectedId?" selected":"");
    el.style.left=pos.x+"px"; el.style.top=pos.y+"px";
    el.innerHTML=`<div class="avatar">${avatar(p)}</div><div><strong>${esc(p.nickname||p.name)}</strong><small>${esc(p.name)}${p.birth?` • ${p.birth}`:""}</small></div>`;

    let downX=0,downY=0;
    el.addEventListener("pointerdown",e=>{
      downX=e.clientX; downY=e.clientY;
      drag.on=true; drag.moved=false; drag.cardId=id; drag.x=e.clientX; drag.y=e.clientY;
      drag.sl=drag.l; drag.st=drag.t;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener("pointermove",e=>{
      if(!drag.on||drag.cardId!==id)return;
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(Math.abs(e.clientX-downX)>5||Math.abs(e.clientY-downY)>5)drag.moved=true;
      drag.l=drag.sl+dx; drag.t=drag.st+dy; applyTreeTransform();
    });
    el.addEventListener("pointerup",e=>{
      if(!drag.on||drag.cardId!==id)return;
      const moved=drag.moved||Math.abs(e.clientX-downX)>5||Math.abs(e.clientY-downY)>5;
      drag.on=false; drag.cardId="";
      if(moved)return;
      selectedId=id;
      const target=positions[id];
      const vw=$("#treeViewport").clientWidth,vh=$("#treeViewport").clientHeight;
      drag.l=vw/2-(target.x+NODE_W/2)*scale;
      drag.t=vh/2-(target.y+NODE_H/2)*scale;
      renderAll(true);
    });
    el.ondblclick=e=>{e.stopPropagation();openModal(id)};
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
  $("#quickAddContext").innerHTML=`<strong>Đang thêm người cho: ${esc(p.nickname||p.name)}</strong><span class="muted">Sau khi chọn quan hệ, app sẽ tự nối người mới vào đúng vị trí.</span>`;
  $("#quickRelation").value="child";
  $("#quickBirthOrder").value="";
  $("#siblingOrderWrap").classList.add("hidden");
  $("#relationModal").classList.remove("hidden");
}
function closeRelationModal(){$("#relationModal").classList.add("hidden");quickParentId=""}
function prepareRelatedPerson(){
  const base=get(quickParentId); if(!base)return;
  const rel=$("#quickRelation").value;
  const id=crypto.randomUUID();
  const p={id,name:"",nickname:"",gender:rel==="mother"?"female":rel==="father"?"male":rel==="spouse"?(base.gender==="male"?"female":"male"):"male",birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:Number($("#quickBirthOrder").value)||"",notes:"",photo:""};
  // Đóng hộp chọn quan hệ rồi mở form người mới với quan hệ đã được gắn sẵn.
  people.push(p);
  const baseId=base.id;
  if(rel==="child"){
    if(base.gender==="female") p.mother=baseId; else p.father=baseId;
  }else if(rel==="father"){
    const old=base.father; p.father=old?old:""; base.father=id;
  }else if(rel==="mother"){
    const old=base.mother; p.mother=old?old:""; base.mother=id;
  }else if(rel==="spouse"){
    p.spouse=baseId; base.spouse=id;
  }else if(rel==="sibling"){
    p.father=base.father||""; p.mother=base.mother||"";
    if(!p.birthOrder)p.birthOrder=(base.birthOrder||1)+1;
  }
  // Nếu tạo cha/mẹ, giữ vợ/chồng của cha/mẹ quando có thể để sơ đồ đầy đủ hơn.
  if(rel==="father" && base.mother){p.spouse=base.mother;const m=get(base.mother);if(m)m.spouse=id}
  if(rel==="mother" && base.father){p.spouse=base.father;const f=get(base.father);if(f)f.spouse=id}
  save();
  closeRelationModal();
  selectedId=id;
  openModal(id);
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
$("#addPersonBtn").onclick=()=>openModal();$("#closeModal").onclick=closeModal;$("#cancelBtn").onclick=closeModal;
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
  if(p){if(p.gender==="other"&&gender!=="other")p.gender=gender;return p}
  p={id:crypto.randomUUID(),name,nickname:"",gender,birth:"",job:"",hometown:"",father:"",mother:"",spouse:"",birthOrder:"",notes:"",photo:""};
  people.push(p); return p;
}
function splitPeople(text){
  return text.replace(/\s+(?:và|&|,|;|\+|\band\b)\s+/gi,"|").split("|").map(x=>x.trim()).filter(Boolean);
}
function detectGender(role){
  const r=normalizeText(role);
  if(/\b(ba|bo|cha|ong|chu|cau|anh|em trai|con trai|chong|bo chong)\b/.test(r))return "male";
  if(/\b(me|ma|ba|ba noi|ba ngoai|co|di|chi|em gai|con gai|vo|me chong)\b/.test(r))return "female";
  return "other";
}
function connectParent(child,parent,gender){
  if(gender==="female") child.mother=parent.id; else if(gender==="male") child.father=parent.id;
}
function parseFamilyText(text){
  const statements=text.split(/[\n.!?]+/).map(s=>s.trim()).filter(Boolean);
  let created=0, links=0;
  const unresolved=[];
  for(const raw of statements){
    let line=raw.replace(/^[-*•]\s*/,"").trim();
    let m;
    // "A là con của B và C"
    m=line.match(/^(.+?)\s+(?:la|là)\s+(?:con|con trai|con gai)\s+(?:cua|của)\s+(.+)$/i);
    if(m){
      const child=makePerson(m[1],/con gai/i.test(m[0])?"female":/con trai/i.test(m[0])?"male":"other");
      const parts=splitPeople(m[2]);
      parts.forEach((name,i)=>{const par=makePerson(name,i===0?"male":"female"); if(par){connectParent(child,par,par.gender);links++}});
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
    if(m){const female=/vo|vợ/i.test(m[2]);const a=makePerson(m[1],female?"female":"male"),b=makePerson(m[3],female?"male":"female");a.spouse=b.id;b.spouse=a.id;links++;continue;}
    // siblings
    m=line.match(/^(.+?)\s+(?:la|là)\s+(anh|chi|chị|em)\s+(?:cua|của)\s+(.+)$/i);
    if(m){const a=makePerson(m[1],/chi|chị/i.test(m[2])?"female":/anh/i.test(m[2])?"male":"other"),b=makePerson(m[3]);if(!a.father&&!a.mother){a.father=b.father||"";a.mother=b.mother||""}else{if(!b.father)b.father=a.father;if(!b.mother)b.mother=a.mother}links++;continue;}
    unresolved.push(line);
  }
  save();
  return {created,links,unresolved};
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

$("#resetBtn").onclick=()=>{if(confirm("Khôi phục dữ liệu mẫu?")){people=JSON.parse(JSON.stringify(sample));save();selectedId="me";renderAll()}};
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
renderAll();
