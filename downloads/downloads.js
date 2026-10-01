'use strict';
const productNames={pragmatic_workflow:'Pragmatic Workflow',pragmatic_operators:'Pragmatic Operators',pragmatic_suite:'Pragmatic Suite'};
const osNames={windows:'Windows',linux:'Linux',macos:'macOS',universal:'All platforms'};
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function downloadURL(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function validTarget(target){return target&&osNames[target.os]&&['x86_64','arm64','multi'].includes(target.arch)&&Array.isArray(target.houdini_versions)&&target.houdini_versions.length&&target.houdini_versions.every(v=>typeof v==='string'&&v.length>0)&& (target.python_abi===null||typeof target.python_abi==='string');}
function targetMatches(target,filters){return (!filters.os||filters.os==='all'||target.os===filters.os||target.os==='universal')&&(!filters.houdini||filters.houdini==='all'||target.houdini_versions.includes(filters.houdini));}
function visibleRecords(records,filters={}){
  if(!Array.isArray(records))return [];
  return records.filter(row=>row&&productNames[row.product_id]&&row.visibility==='visible'&&['production','daily'].includes(row.channel)&&typeof row.version==='string'&&typeof row.release_id==='string'&&typeof row.build_id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.release_date)&&Array.isArray(row.artifacts)&&downloadURL(row.manifest_url)&&(!filters.product||filters.product==='all'||row.product_id===filters.product))
    .map(row=>({...row,artifacts:row.artifacts.filter(a=>a&&typeof a.filename==='string'&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isSafeInteger(a.size_bytes)&&a.size_bytes>0&&Array.isArray(a.urls)&&a.urls.some(downloadURL)&&Array.isArray(a.targets)&&a.targets.length&&a.targets.every(validTarget)&&a.targets.some(t=>targetMatches(t,filters)))}))
    .filter(row=>row.artifacts.length)
    .sort((a,b)=>(b.published_at||b.release_date).localeCompare(a.published_at||a.release_date)||b.release_id.localeCompare(a.release_id,undefined,{numeric:true}));
}
function groupReleases(rows){
  const production=rows.filter(r=>r.channel==='production'),daily=rows.filter(r=>r.channel==='daily'),recent=[],older=[],counts={};
  for(const row of daily){const count=counts[row.product_id]||0;(count<3?recent:older).push(row);counts[row.product_id]=count+1;}
  return {production,recent,older};
}
function targetLabel(t){return osNames[t.os]+' '+t.arch+' · Packaged for Houdini '+t.houdini_versions.join(', ')+(t.python_abi?' · Python '+t.python_abi:'');}
function releaseCard(row,latest){
  const card=element('article',undefined,'release');card.dataset.buildId=row.build_id;
  const heading=element('div',undefined,'release-heading');heading.append(element('h3',productNames[row.product_id]+' '+row.version+(row.revision?' · Revision '+row.revision:'')));
  heading.append(element('span',latest?'Latest '+row.channel:row.channel==='production'?'Production build':'Daily build','badge '+row.channel));card.append(heading);
  card.append(element('p','Released '+row.release_date+' · '+row.release_id,'meta'));
  if(row.houdini_min||row.houdini_max)card.append(element('p','Supported range: '+(row.houdini_min||'Not specified')+' to '+(row.houdini_max||'Not specified')+'. Choose an exact packaged target below.','compatibility'));
  if(row.required_runtime_abi)card.append(element('p','License runtime ABI '+row.required_runtime_abi,'meta'));
  for(const artifact of row.artifacts){
    const line=element('div',undefined,'artifact');line.append(element('span',artifact.targets.map(targetLabel).join(' / ')));
    const link=element('a','Download ZIP','download');link.href=artifact.urls.map(downloadURL).find(Boolean);link.rel='noopener';line.append(link);card.append(line);
    const hash=element('details',undefined,'details');hash.append(element('summary','File details'),element('p',artifact.filename+' · '+(artifact.size_bytes/1048576).toFixed(1)+' MB'),element('code','SHA256 '+artifact.sha256));card.append(hash);
  }
  const manifest=element('a','Signed release manifest','manifest');manifest.href=downloadURL(row.manifest_url);manifest.rel='noopener';card.append(manifest);
  if(Array.isArray(row.notes)&&row.notes.length){const notes=element('details',undefined,'details');notes.append(element('summary','Release notes'));const list=element('ul');for(const note of row.notes)if(typeof note==='string')list.append(element('li',note));notes.append(list);card.append(notes);}
  return card;
}
function appendSection(container,title,rows,description,markLatest=true){
  if(!rows.length)return;
  const section=element('section',undefined,'channel');section.append(element('h2',title));if(description)section.append(element('p',description));const latest=new Set();
  for(const row of rows){const first=markLatest&&!latest.has(row.product_id);latest.add(row.product_id);section.append(releaseCard(row,first));}container.append(section);
}
function renderReleases(records,product,container,filters={}){
  container.replaceChildren();const rows=visibleRecords(records,{...filters,product});
  if(!rows.length){container.append(element('p','No published releases match this selection.','empty'));return 0;}
  const groups=groupReleases(rows);
  appendSection(container,'Production builds',groups.production,'Recommended releases. Choose the package for your operating system and exact Houdini build.');
  appendSection(container,'Latest daily builds',groups.recent,'The latest three published revisions per product. Daily builds are separate downloads.');
  if(groups.older.length){const older=element('details',undefined,'archive');older.append(element('summary','View all older daily builds ('+groups.older.length+')'));appendSection(older,'Older daily builds',groups.older,'Availability follows the daily-build retention policy.',false);container.append(older);}
  return rows.length;
}
async function start(){
  const selector=document.getElementById('product'),os=document.getElementById('os'),houdini=document.getElementById('houdini'),status=document.getElementById('status'),container=document.getElementById('releases');
  const query=new URLSearchParams(location.search).get('product');if(productNames[query])selector.value=query;
  try{
    const response=await fetch('releases.json',{cache:'no-cache'});if(!response.ok)throw Error('Catalog unavailable');const data=await response.json();if(data.schema_version!==1||!Array.isArray(data.releases))throw Error('Invalid catalog');
    const builds=[...new Set(visibleRecords(data.releases).flatMap(row=>row.artifacts.flatMap(a=>a.targets.flatMap(t=>t.houdini_versions))))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
    for(const build of builds){const option=element('option',build);option.value=build;houdini.append(option);}
    const redraw=()=>{const count=renderReleases(data.releases,selector.value,container,{os:os.value,houdini:houdini.value});status.textContent=count?count+' published release'+(count===1?'':'s'):'';};for(const control of [selector,os,houdini])control.addEventListener('change',redraw);redraw();
  }catch{container.replaceChildren();status.textContent='Release information is temporarily unavailable. Please try again later.';}
}
if(typeof document!=='undefined')start();
if(typeof module!=='undefined')module.exports={downloadURL,visibleRecords,groupReleases,targetLabel,renderReleases};
