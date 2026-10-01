'use strict';
const productNames={pragmatic_workflow:'Pragmatic Workflow',pragmatic_operators:'Pragmatic Operators'};
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function downloadURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function renderReleases(records,product,container){
  container.replaceChildren();
  const rows=records.filter(r=>productNames[r.product_id]&&(product==='all'||r.product_id===product)).sort((a,b)=>b.release_date.localeCompare(a.release_date)||b.release_id.localeCompare(a.release_id,undefined,{numeric:true}));
  if(!rows.length){container.append(element('p','No published releases are listed yet.','empty'));return 0;}
  for(const row of rows){
    const card=element('article',undefined,'release');
    card.append(element('h2',productNames[row.product_id]+' '+row.version+(row.revision?' · Revision '+row.revision:'')));
    card.append(element('p','Released '+row.release_date+' · '+row.release_id,'meta'));
    for(const artifact of row.artifacts){
      const line=element('div',undefined,'artifact');
      line.append(element('span',artifact.targets.map(t=>t.os+' '+t.arch+' · Houdini '+t.houdini_versions.join(', ')).join(' / ')));
      const url=artifact.urls.map(downloadURL).find(Boolean);
      if(url){const link=element('a','Download','download');link.href=url;link.rel='noopener';line.append(link);}else{line.append(element('span','Download not published'));}
      card.append(line);
      const hash=element('details',undefined,'details');hash.append(element('summary','File details'),element('p',artifact.filename+' · '+(artifact.size_bytes/1048576).toFixed(1)+' MB'),element('code','SHA256 '+artifact.sha256));card.append(hash);
    }
    const manifest=downloadURL(row.manifest_url);if(manifest){const link=element('a','Signed release manifest','download');link.href=manifest;link.rel='noopener';card.append(link);}
    const notes=element('details',undefined,'details');notes.append(element('summary','Release notes'));const list=element('ul');
    for(const note of row.notes)list.append(element('li',note));notes.append(list);card.append(notes);container.append(card);
  }
  return rows.length;
}
async function start(){
  const selector=document.getElementById('product'),status=document.getElementById('status'),container=document.getElementById('releases');
  const query=new URLSearchParams(location.search).get('product');if(productNames[query])selector.value=query;
  try{
    const response=await fetch('releases.json',{cache:'no-cache'});if(!response.ok)throw Error('Catalog unavailable');const data=await response.json();
    if(data.schema_version!==1||!Array.isArray(data.releases))throw Error('Invalid catalog');
    const redraw=()=>{const count=renderReleases(data.releases,selector.value,container);status.textContent=count?count+' release'+(count===1?'':'s'):'';};selector.addEventListener('change',redraw);redraw();
  }catch{status.textContent='Release information is temporarily unavailable. Please try again later.';}
}
if(typeof document!=='undefined')start();
if(typeof module!=='undefined')module.exports={downloadURL,renderReleases};
