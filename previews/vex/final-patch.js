/* Final-facing editorial layout. Original page and media remain unchanged. */
(()=>{
'use strict';
const q=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const setText=(selector,value)=>{const e=q(selector);if(e)e.textContent=value;};
const rm=selector=>all(selector).forEach(e=>e.remove());
document.title='Pragmatic VEX | Advanced Houdini VEX Courses';
const description=q('meta[name="description"]');
if(description)description.content='Advanced Houdini VEX courses focused on production problem-solving, geometry algorithms, custom subdivision, field analysis, numerical methods and reusable procedural tools.';
rm('.standalone-line');
const heroActions=all('.hero-actions a');
if(heroActions[0])heroActions[0].innerHTML='Explore both volumes <span aria-hidden="true">↓</span>';
if(heroActions[1]){heroActions[1].href='#pricing';heroActions[1].innerHTML='Get the complete bundle <span aria-hidden="true">↗</span>';}
setText('.nav-action','Complete bundle');
const placeholder=q('.trailer-placeholder');
if(placeholder){
 const btn=document.createElement('button');
 btn.type='button';btn.className='video-cover';
 btn.dataset.previewVideo='NO5lN3K_7YM';btn.dataset.video='NO5lN3K_7YM';
 btn.dataset.title='Volume 2 · The Eigenveil of Entropy';btn.setAttribute('aria-label','Play Volume 2 trailer');
 btn.innerHTML='<img src="https://i.ytimg.com/vi/NO5lN3K_7YM/maxresdefault.jpg" alt="Volume 2 trailer" width="1280" height="720" decoding="async"><span class="play-symbol" aria-hidden="true"><svg class="play-vector" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31"/><path d="M26 21 L44 32 L26 43 Z"/></svg></span>';
 placeholder.replaceWith(btn);
}
setText('.course-film-grid article:first-child .film-vol','Volume 2 · Houdini 22');
setText('.course-film-grid article:last-child .film-vol','Volume 1 · Houdini 21');
setText('.course-film-grid article:first-child .course-status','4K lessons · Scene files and supporting material');
setText('.course-film-grid article:last-child .course-status','163 lessons · Over 15 hours · 4K video');
all('.course-film-grid .price').forEach(p=>{
  const block=document.createElement('div');
  block.className='price-block';
  block.setAttribute('aria-label','Regular price $795; existing customers $695');
  block.innerHTML='<strong class="price-main">$795</strong>'+
    '<div class="price-returning"><span>Existing customers</span><strong>$695</strong></div>';
  p.replaceWith(block);
});
rm('.release-alert,.loyalty');
const bundle=q('.bundle-wrap'), proof=q('.proof-section');
if(bundle&&proof)proof.before(bundle);
const bundleLink='mailto:animatrix2k7@gmail.com?subject=Pragmatic%20VEX%20complete%20bundle%20purchase';
const bundleBtn=q('.bundle-panel button.primary');
if(bundleBtn){const a=document.createElement('a');a.href=bundleLink;a.className='primary full purchase-link';a.textContent='Buy both volumes · $1,390';bundleBtn.replaceWith(a);}
all('.bundle-panel li').forEach(e=>{e.textContent=e.textContent.replace('Current and listed future Volume 2 chapter updates','The complete curriculum across both volumes');});
setText('.curriculum-head h2','Full curriculum');
setText('.curriculum-head p','Explore the topics, techniques and implementation details covered in each volume.');
setText('#panel-v2 .film-vol','Volume 2 · Houdini 22');
setText('#panel-v1 .film-vol','Volume 1 · Houdini 21');
setText('#panel-v2 .curriculum-meta','4K video · Scene files and supporting material');
setText('#panel-v1 .curriculum-meta','163 videos · Over 15 hours · 4K video');
rm('.status-badge,.availability-note');
all('.topic-category').forEach(e=>e.open=true);
const module8=all('#panel-v2 .topic-category').find(e=>e.querySelector('summary')?.textContent.startsWith('8. '));
if(module8){const ul=module8.querySelector('ul');if(ul){const item=document.createElement('li');item.innerHTML='Set up discrete linear systems, apply boundary constraints and solve the resulting equations. <span class="terms">Sparse operators, <code>A·x=b</code>, numerical solvers and reconstruction.</span>';ul.prepend(item);}}
const planned=q('.planned-updates');
if(planned){
 const section=document.createElement('details');section.className='topic-category';section.open=true;
 section.innerHTML='<summary>10. Ocean spectra and fluid-sheet refinement</summary><ul><li>Reconstruct ocean surfaces and motion from spectral information using inverse-spectrum methods.</li><li>Apply anisotropy-aware refinement and gap filling to thin FLIP sheets, preserving sheet structure and local flow direction.</li></ul>';
 planned.replaceWith(section);
}
const faqs=all('#faq .faq details');
const outdated=faqs.find(x=>x.querySelector('summary')?.textContent.includes('outdated'));
if(outdated){outdated.querySelector('summary').textContent='Which Houdini versions are the courses for?';outdated.querySelector('p').textContent='Volume 1: Houdini 21. Volume 2: Houdini 22. The version shown alongside each volume identifies the supported Houdini edition of its course material.';}
const math=faqs.find(x=>x.querySelector('summary')?.textContent.includes('mathematics course'));
if(math){math.querySelector('summary').textContent='How is mathematics used in the lessons?';math.querySelector('p').textContent='The focus is on production techniques, practical problem-solving and implementation in VEX. Mathematical concepts are explained in the context of geometry, fields, deformation, simulation and building reusable Houdini tools.';}
const available=faqs.find(x=>x.querySelector('summary')?.textContent.includes('currently available'));
if(available){available.querySelector('summary').textContent='What subjects does Volume 2 cover?';available.querySelector('p').textContent='Matrix decompositions, fitting, ICP, bounding geometry, surface curvature, OpenSubdiv derivatives, differential operators, velocity-gradient analysis, numerical systems, Helmholtz decomposition, ocean spectra and thin FLIP sheet refinement. See the complete curriculum for the detailed breakdown.';}
const bottom=q('.bottom-cta button');
if(bottom){const a=document.createElement('a');a.href='#pricing';a.className='primary';a.textContent='Get the complete bundle';bottom.replaceWith(a);}
setText('.foot > span','© 2026 Pragmatic VFX');
rm('.preview-badge');
})();