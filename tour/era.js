(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
var B=document.body, page=B.getAttribute('data-page');
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

/* menu + page transition */
var bg=$('.burger'),nv=$('.nav');
if(bg)bg.addEventListener('click',function(){var o=nv.classList.toggle('open');bg.setAttribute('aria-expanded',o)});
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||a.target)return;
  var h=a.getAttribute('href');if(/^(#|mailto:|https?:)/.test(h))return;
  var base=h.split('#')[0];if(!base||base===location.pathname.split('/').pop())return;
  e.preventDefault();B.classList.add('leaving');setTimeout(function(){location.href=h},320);
});
window.addEventListener('pageshow',function(){B.classList.remove('leaving')});

/* pictures: one fixed slot per room; local file first, optional remote fallback */
$$('.fig').forEach(function(f){
  var im=$('img',f);if(!im)return;
  function ok(){f.classList.add('has');f.setAttribute('data-lb','1');var c=f.querySelector('.credit[data-local]')||f.parentNode.querySelector('.credit[data-local]');if(c)c.hidden=false}
  im.addEventListener('load',function(){if(im.naturalWidth>40)ok()});
  im.addEventListener('error',function(){
    var q=(im.getAttribute('data-alts')||'').split(',').filter(Boolean),fb=im.getAttribute('data-fb'),ar=im.getAttribute('data-art');
    if(fb)q.push(fb);if(ar)q.push(ar);var n=+im.dataset.ai||0;
    if(n<q.length){im.dataset.ai=n+1;var u=q[n];
      if(u===fb){var c=f.querySelector('.credit[data-remote]');if(c)c.hidden=false}
      if(u===ar){f.classList.add('isart')}
      im.src=u}
  });
  if(im.complete&&im.naturalWidth>40)ok();
});
document.addEventListener('click',function(e){
  if(e.target.closest('.xcard,.tit'))return;var f=e.target.closest('.fig.has');if(!f)return;
  var d=document.createElement('div');d.className='lb';
  d.innerHTML='<img alt=""><p></p>';$('img',d).src=$('img',f).src;$('p',d).textContent=f.getAttribute('data-cap')||'';
  d.addEventListener('click',function(){d.remove()});document.body.appendChild(d);
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var l=$('.lb');if(l)l.remove()}});

/* reveal on scroll */
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}})},{threshold:.12,rootMargin:'0px 0px -6% 0px'}):null;
$$('.rv').forEach(function(el,i){el.style.transitionDelay=((i%4)*90)+'ms';if(io)io.observe(el);else el.classList.add('in')});

/* scroll engine: --e / --p per room, progress bar, rail, timeline, parallax */
var rooms=$$('[data-room]'),rail=$$('.rail a'),tl=$('.tl'),tns=$$('.tn'),floats=$$('.float'),tick=false;
function frame(){
  tick=false;var vh=innerHeight,y=scrollY,max=document.documentElement.scrollHeight-vh;
  B.style.setProperty('--sp',max>0?clamp(y/max,0,1).toFixed(4):0);
  var best=-1,bd=1e9;
  rooms.forEach(function(r,i){
    var b=r.getBoundingClientRect();
    var e=RM?1:clamp((vh*0.92-b.top)/(vh*0.6),0,1),p=clamp((vh-b.top)/(vh+b.height),0,1);
    r.style.setProperty('--e',e.toFixed(3));r.style.setProperty('--p',p.toFixed(3));
    var d=Math.abs(b.top+b.height/2-vh/2);if(b.top<vh*.6&&b.bottom>vh*.3&&d<bd){bd=d;best=i}
  });
  rail.forEach(function(a,i){a.classList.toggle('on',i===best)});
  if(best>=0&&rooms[best].style.getPropertyValue('--cat'))B.style.setProperty('--cat',rooms[best].style.getPropertyValue('--cat'));
  if(tl){
    var tb=tl.getBoundingClientRect(),f=clamp((vh*.6-tb.top)/tb.height,0,1);tl.style.setProperty('--fill',f.toFixed(4));
    tns.forEach(function(n){n.classList.toggle('on',n.getBoundingClientRect().top<vh*.68)});
  }
  floats.forEach(function(f){f.style.setProperty('--sy',y.toFixed(0))});
}
function req(){if(!tick){tick=true;requestAnimationFrame(frame)}}
addEventListener('scroll',req,{passive:true});addEventListener('resize',req);frame();
addEventListener('pointermove',function(e){
  var mx=e.clientX-innerWidth/2,my=e.clientY-innerHeight/2;
  floats.forEach(function(f){f.style.setProperty('--mx',mx);f.style.setProperty('--my',my)});
  if(page==='present'){var fg=e.target.closest&&e.target.closest('.room-pic .fig');if(fg){var r=fg.getBoundingClientRect();fg.style.setProperty('--tx',(((e.clientX-r.left)/r.width-.5)*14).toFixed(1)+'deg');fg.style.setProperty('--ty',(-((e.clientY-r.top)/r.height-.5)*14).toFixed(1)+'deg')}}
},{passive:true});
document.addEventListener('pointerleave',function(e){var fg=e.target.closest&&e.target.closest('.fig');if(fg){fg.style.setProperty('--tx','0deg');fg.style.setProperty('--ty','0deg')}},true);

/* trivia flip */
$$('.tcard').forEach(function(c){c.addEventListener('click',function(){var o=c.classList.toggle('flipped');c.setAttribute('aria-pressed',o)})});

/* future: aspect tabs */
document.addEventListener('click',function(e){
  var b=e.target.closest('.atabs button');if(!b)return;var box=b.closest('.aspects');
  $$('.atabs button',box).forEach(function(x){x.classList.toggle('on',x===b)});
  $$('.apanel',box).forEach(function(p){p.classList.toggle('on',p.getAttribute('data-a')===b.getAttribute('data-a'))});
});
/* hash: open exhibit / jump */
function fromHash(){
  var id=decodeURIComponent(location.hash.slice(1));if(!id)return;
  var el=document.getElementById(id);if(!el)return;
  if(el.tagName==='DETAILS')el.open=true;
  setTimeout(function(){el.scrollIntoView({behavior:RM?'auto':'smooth',block:'center'})},350);
}
addEventListener('hashchange',fromHash);addEventListener('load',fromHash);

/* ---- canvases ---- */
function mk(){var c=document.createElement('canvas');c.className='fx';c.setAttribute('aria-hidden','true');document.body.appendChild(c);var x=c.getContext('2d');function s(){c.width=innerWidth;c.height=innerHeight}s();addEventListener('resize',s);return {c:c,x:x}}
/* PAST: drifting dust + burst when a picture appears */
if(page==='past'&&!RM){
  var D=mk(),dust=[],N=70;
  for(var i=0;i<N;i++)dust.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.25,vy:-Math.random()*.25-.05,a:Math.random()*.5+.15,life:1,burst:0});
  window.dustBurst=function(rect,n){n=n||110;for(var i=0;i<n;i++)dust.push({x:rect.left+Math.random()*rect.width,y:rect.top+Math.random()*rect.height,r:Math.random()*2.4+.6,vx:(Math.random()-.3)*2.6,vy:-Math.random()*2.2-.3,a:.9,life:1,burst:1})};
  (function loop(){
    D.x.clearRect(0,0,D.c.width,D.c.height);
    for(var i=dust.length-1;i>=0;i--){var p=dust[i];p.x+=p.vx;p.y+=p.vy;
      if(p.burst){p.life-=.012;p.vx*=.99;p.vy+=.004;if(p.life<=0){dust.splice(i,1);continue}}
      else{if(p.y<-5)p.y=innerHeight+5;if(p.x<-5)p.x=innerWidth+5;if(p.x>innerWidth+5)p.x=-5}
      D.x.globalAlpha=p.a*(p.burst?p.life:1);D.x.fillStyle=p.burst?'#e4cf9a':'#f3dfae';D.x.beginPath();D.x.arc(p.x,p.y,p.r,0,6.3);D.x.fill()}
    requestAnimationFrame(loop)})();
  var seen=new WeakSet();
  if(io){var po=new IntersectionObserver(function(es){es.forEach(function(en){
    var f=en.target;
    if(en.isIntersecting&&!seen.has(f)){seen.add(f);var r=f.getBoundingClientRect();f.style.animation='dustIn 1.8s ease both';window.dustBurst(r,90)}
    else if(!en.isIntersecting&&seen.has(f)&&f.getBoundingClientRect().bottom<0){seen.delete(f);window.dustBurst({left:innerWidth*.1,top:30,width:innerWidth*.4,height:60},40)}
  })},{threshold:.35});$$('.room-pic .fig').forEach(function(f){po.observe(f)})}
}
/* FUTURE: particle network reacting to pointer */
if(page==='future'&&!RM){
  var F=mk(),pts=[],M={x:-999,y:-999},n=Math.min(90,Math.floor(innerWidth/16));
  for(var j=0;j<n;j++)pts.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4});
  addEventListener('pointermove',function(e){M.x=e.clientX;M.y=e.clientY},{passive:true});
  (function loop(){
    F.x.clearRect(0,0,F.c.width,F.c.height);
    pts.forEach(function(p,i){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>innerWidth)p.vx*=-1;if(p.y<0||p.y>innerHeight)p.vy*=-1;
      var dm=Math.hypot(p.x-M.x,p.y-M.y);if(dm<140){p.x+=(p.x-M.x)*.012;p.y+=(p.y-M.y)*.012}
      F.x.fillStyle='rgba(56,249,255,.8)';F.x.fillRect(p.x-1,p.y-1,2,2);
      for(var k=i+1;k<pts.length;k++){var q=pts[k],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<120){F.x.strokeStyle='rgba(120,170,255,'+(.22*(1-d/120))+')';F.x.beginPath();F.x.moveTo(p.x,p.y);F.x.lineTo(q.x,q.y);F.x.stroke()}}
      if(dm<150){F.x.strokeStyle='rgba(56,249,255,'+(.5*(1-dm/150))+')';F.x.beginPath();F.x.moveTo(p.x,p.y);F.x.lineTo(M.x,M.y);F.x.stroke()}});
    requestAnimationFrame(loop)})();
}
/* LOBBY: soft mixed particles */
if(page==='home'&&!RM){
  var L=mk(),lp=[],cols=['230,199,115','255,79,163','56,249,255'];
  for(var m=0;m<60;m++)lp.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*2+.5,vy:-Math.random()*.5-.1,c:cols[m%3],a:Math.random()*.6+.2});
  (function loop(){L.x.clearRect(0,0,L.c.width,L.c.height);lp.forEach(function(p){p.y+=p.vy;p.x+=Math.sin(p.y/60)*.3;if(p.y<-5){p.y=innerHeight+5;p.x=Math.random()*innerWidth}L.x.fillStyle='rgba('+p.c+','+p.a+')';L.x.beginPath();L.x.arc(p.x,p.y,p.r,0,6.3);L.x.fill()});requestAnimationFrame(loop)})();
}
/* typewriter */
$$('.type').forEach(function(el){var t=el.getAttribute('data-text'),i=0;el.textContent='';(function s(){if(i<=t.length){el.textContent=t.slice(0,i++);setTimeout(s,RM?0:38)}})()});
/* year counter (present hero) */
$$('.count').forEach(function(el){var a=+el.getAttribute('data-from'),b=+el.getAttribute('data-to'),st=null;function s(ts){st=st||ts;var k=clamp((ts-st)/1400,0,1);el.textContent=Math.round(a+(b-a)*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(s)}RM?el.textContent=b:requestAnimationFrame(s)});

/* ---- THEN or NOW quiz ---- */
(function(){
  var box=$('#quiz'),raw=$('#quizdata');if(!box||!raw)return;
  var Q=JSON.parse(raw.textContent),order,i,score,streak,best;
  function sh(a){a=a.slice();for(var k=a.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1)),t=a[k];a[k]=a[j];a[j]=t}return a}
  function show(){
    var q=order[i];$('#qCount').textContent='Question '+(i+1)+' / '+order.length;$('#qBar').style.width=(i/order.length*100)+'%';
    $('#qText').textContent=q.s;$('#qRes').hidden=true;$$('.q-opt').forEach(function(b){b.disabled=false;b.className='q-opt'});
    $('#qStreak').textContent=streak>1?'🔥 '+streak+' in a row':'';
  }
  function start(){order=sh(Q);i=0;score=0;streak=0;$('#qIntro').hidden=true;$('#qEnd').hidden=true;$('#qPlay').hidden=false;show()}
  function ans(a){
    var q=order[i];$$('.q-opt').forEach(function(b){b.disabled=true;var v=b.getAttribute('data-a');if(v===q.a)b.classList.add('good');else if(v===a)b.classList.add('bad')});
    var ok=a===q.a;if(ok){score++;streak++}else streak=0;
    $('#qVerdict').textContent=ok?'Correct!':'Not quite.';$('#qWhy').textContent=q.w;$('#qRes').hidden=false;$('#qNext').textContent=i===order.length-1?'See my result':'Next →';
    $('#qStreak').textContent=streak>1?'🔥 '+streak+' in a row':'';
  }
  function end(){
    $('#qPlay').hidden=true;$('#qEnd').hidden=false;$('#qScore').textContent=score+' / '+order.length;
    var t=score>=11?'Master Curator':score>=8?'Seasoned Archivist':score>=5?'Curious Visitor':'First-Time Visitor';
    $('#qTitle').textContent=t;$('#qMsg').textContent=score>=8?'You know your Philippine pop culture across the decades.':'Walk the Past and Present rooms again, then try for a higher title.';
    box.scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('#qStart').addEventListener('click',start);$('#qAgain').addEventListener('click',start);
  $$('.q-opt').forEach(function(b){b.addEventListener('click',function(){ans(b.getAttribute('data-a'))})});
  $('#qNext').addEventListener('click',function(){i++;i>=order.length?end():show()});
})();
})();

/* console: exhibit cards modal + arrows */
(function(){
function openX(c){var t=c.querySelector('template');if(!t)return;var m=document.createElement('div');m.className='xmodal';m.innerHTML='<div class="box"><button class="x" aria-label="Close">&times;</button>'+t.innerHTML+'</div>';document.body.appendChild(m);
 function cl(){m.remove();document.removeEventListener('keydown',kd)}function kd(ev){if(ev.key==='Escape')cl()}
 document.addEventListener('keydown',kd);m.addEventListener('click',function(ev){if(ev.target===m||ev.target.classList.contains('x'))cl()})}
document.addEventListener('click',function(e){
 var c=e.target.closest('.xcard,.tit');if(c){openX(c);return}
 var b=e.target.closest('.xp,.xn');if(b){var r=b.closest('.cbody').querySelector('.xrow');if(r)r.scrollBy({left:(b.classList.contains('xn')?1:-1)*r.clientWidth*.8,behavior:'smooth'})}});
function hash(){var h=location.hash.slice(1);if(!h)return;var c=document.querySelector('.xcard[data-id="'+h+'"]');if(c){c.scrollIntoView({block:'center'});setTimeout(function(){openX(c)},300)}}
window.addEventListener('hashchange',hash);setTimeout(hash,400);
})();

/* 3D museum tour: scroll = walk */
(function(){
var T=document.querySelector('[data-tour]');if(!T)return;
var W=T.querySelector('.tworld'),items=[].slice.call(T.querySelectorAll('.tit,.tgate')),N=items.length,STEP=640,D=N*STEP+1400;
var u=1,mx=0,my=0,zc=0,tz=0,labels=T.querySelector('.troom'),cnt=T.querySelector('.tcount'),chips=[].slice.call(T.querySelectorAll('.tchips button')),hint=T.querySelector('.thint');
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;if(rm)return;
T.style.setProperty('--D',D+'px');
items.forEach(function(el,i){el.style.setProperty('--z',(-i*STEP-700)+'px')});
function size(){u=Math.min(1,Math.max(.55,innerWidth/1100));T.style.setProperty('--u',u)}size();window.addEventListener('resize',size);
function prog(){var r=T.getBoundingClientRect(),h=T.offsetHeight-innerHeight;return Math.min(1,Math.max(0,-r.top/h))}
function goto(i){var h=T.offsetHeight-innerHeight,y=T.getBoundingClientRect().top+scrollY;var p=(i*STEP)/((N-1)*STEP+300);scrollTo({top:y+h*Math.min(1,p),behavior:'smooth'})}
var cur=0;
function frame(){
 var p=prog(),total=(N-1)*STEP+300;tz=p*total;zc+=(tz-zc)*.12;
 var bob=Math.sin(zc/90)*3;
 W.style.transform='translate3d('+(mx*-30)+'px,'+(bob+my*-14)+'px,'+(zc+0)+'px) rotateY('+(mx*3)+'deg) rotateX('+(my*-2)+'deg)';
 var best=0,bd=1e9,room='';
 for(var i=0;i<N;i++){var el=items[i],z=-i*STEP-700+zc,o;
  if(z<-3200)o=0;else if(z<-2200)o=(z+3200)/1000;else if(z>350)o=0;else if(z>-100)o=Math.max(0,(350-z)/450);else o=1;
  el.style.opacity=o.toFixed(2);el.style.pointerEvents=o>.5?'auto':'none';el.style.visibility=o<=0?'hidden':'visible';
  var d=Math.abs(z+420);if(d<bd){bd=d;best=i}}
 cur=best;var be=items[best];var rid=be.classList.contains('tgate')?be.getAttribute('data-room'):null;
 for(var j=best;j>=0&&!rid;j--)if(items[j].classList.contains('tgate'))rid=items[j].getAttribute('data-room');
 chips.forEach(function(c){var g=items[+c.getAttribute('data-go')];c.classList.toggle('on',g&&g.getAttribute('data-room')===rid)});
 var g2=T.querySelector('.tgate[data-room="'+rid+'"] b');if(labels)labels.textContent=(g2?g2.textContent:'Lobby')+' · '+(best+1)+'/'+N;
 if(cnt)cnt.textContent=(best+1)+' / '+N;
 if(hint)hint.style.opacity=p>.02?0:1;
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
T.addEventListener('pointermove',function(e){mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
chips.forEach(function(c){c.addEventListener('click',function(){goto(+c.getAttribute('data-go'))})});
T.querySelector('.tnext').addEventListener('click',function(){goto(Math.min(N-1,cur+1))});
T.querySelector('.tprev').addEventListener('click',function(){goto(Math.max(0,cur-1))});
document.addEventListener('keydown',function(e){if(document.querySelector('.xmodal'))return;var r=T.getBoundingClientRect();if(r.top>0||r.bottom<innerHeight)return;if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();goto(Math.min(N-1,cur+1))}if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();goto(Math.max(0,cur-1))}});
T.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.classList.contains('tit'))e.target.click()});
})();
