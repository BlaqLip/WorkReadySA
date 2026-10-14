const toggle=document.querySelector('.nav-toggle'),navLinks=document.getElementById('navLinks');
function closeMenu(){navLinks?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');}
toggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
navLinks?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('click',e=>{if(!e.target.closest('.nav'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=navLinks?.classList.contains('open');closeMenu();if(open)toggle?.focus();}});
window.addEventListener('resize',()=>{if(innerWidth>760)closeMenu();});
function filterResources(category){let visible=0;document.querySelectorAll('.blog-card').forEach(card=>{const match=category==='All'||card.dataset.category===category||(category==='Career Advice'&&['CV Tips','Interview Tips'].includes(card.dataset.category));card.hidden=!match;if(match)visible++;});document.querySelectorAll('.cat-btn').forEach(btn=>{const active=btn.textContent.trim()===category;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});const empty=document.getElementById('emptyResources');if(empty)empty.hidden=visible>0;}
document.querySelectorAll('.cat-btn').forEach(btn=>{btn.setAttribute('aria-pressed',String(btn.classList.contains('active')));btn.addEventListener('click',()=>filterResources(btn.textContent.trim()));});
document.querySelectorAll('[data-filter]').forEach(link=>link.addEventListener('click',()=>filterResources(link.dataset.filter)));
