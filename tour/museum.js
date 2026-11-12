/* The Archive: first-person 3D museum (raw WebGL2, no libraries) */
(function(){
'use strict';
var D=JSON.parse(document.getElementById('mdata').textContent);
var $=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))};
var cv=$('#gl'),gl=cv.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl){$('#nogl').hidden=false;$('#nogl').innerHTML='<h2>Explore the collection</h2><p>3D is unavailable on this device. All exhibits are available in the accessible collection.</p><a href="'+(location.pathname.indexOf('/tour/')>-1?'../':'')+'collection.html" target="_top">Open the collection →</a>';return}
cv.addEventListener('webglcontextlost',function(e){e.preventDefault();document.getElementById('nogl').hidden=false});
var aniso=gl.getExtension('EXT_texture_filter_anisotropic'),maxAn=aniso?Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):0;
/* ---------------- math ---------------- */
function mul(a,b){var o=new Float32Array(16);for(var i=0;i<4;i++)for(var j=0;j<4;j++){var s=0;for(var k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o}
function persp(f,a,n,fa){var t=1/Math.tan(f/2),o=new Float32Array(16);o[0]=t/a;o[5]=t;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa);return o}
function ident(){var o=new Float32Array(16);o[0]=o[5]=o[10]=o[15]=1;return o}
function trans(x,y,z){var o=ident();o[12]=x;o[13]=y;o[14]=z;return o}
function rotY(a){var o=ident(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o}
function rotX(a){var o=ident(),c=Math.cos(a),s=Math.sin(a);o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o}
function rotZ(a){var o=ident(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o}
function scl(x,y,z){var o=ident();o[0]=x;o[5]=y;o[10]=z;return o}
var MIRROR=scl(1,-1,1),I4=ident();
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
/* ---------------- shaders ---------------- */
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(o));return o}
function prog(v,f){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);return p}
var P=prog('#version 300 es\nin vec3 aP;in vec3 aN;in vec2 aT;uniform mat4 uVP;uniform mat4 uM;uniform mat4 uMod;out vec3 vW;out vec3 vN;out vec2 vT;void main(){vec4 w=uMod*vec4(aP,1.);vW=w.xyz;vN=mat3(uMod)*aN;vT=aT;gl_Position=uVP*uM*w;}',
'#version 300 es\nprecision highp float;in vec3 vW;in vec3 vN;in vec2 vT;uniform sampler2D uTex;uniform float uUseTex;uniform vec4 uCol;uniform float uEmi;uniform vec3 uAmb;uniform vec3 uCam;uniform vec3 uFog;uniform float uFogD;uniform vec4 uL[8];uniform vec3 uLC[8];uniform float uTime;uniform float uScan;out vec4 o;void main(){vec4 t=uUseTex>.5?texture(uTex,vT):vec4(1.);vec3 base=t.rgb*uCol.rgb;vec3 n=normalize(vN);vec3 vd=uCam-vW;if(dot(n,vd)<0.)n=-n;vec3 lit=uAmb;for(int i=0;i<8;i++){vec3 d=uL[i].xyz-vW;float dist=length(d);float a=clamp(1.-dist/uL[i].w,0.,1.);a*=a;float df=max(dot(n,d/dist),0.)*.75+.25;lit+=uLC[i]*a*df;}vec3 c=base*(lit+uEmi);c=vec3(1.)-exp(-c*1.35);if(uScan>0.){c+=vec3(.0,.35,.4)*uScan*(.5+.5*sin(vT.y*220.+uTime*3.));}float dd=length(vd);float f=1.-exp(-uFogD*uFogD*dd*dd);c=mix(c,uFog,clamp(f,0.,1.));o=vec4(c,uCol.a*t.a);}');
var U={};['uVP','uM','uMod','uTex','uUseTex','uCol','uEmi','uAmb','uCam','uFog','uFogD','uL','uLC','uTime','uScan'].forEach(function(n){U[n]=gl.getUniformLocation(P,n)});
var PD=prog('#version 300 es\nin vec3 aP;uniform mat4 uVP;uniform float uSz;void main(){gl_Position=uVP*vec4(aP,1.);gl_PointSize=clamp(uSz/gl_Position.w,1.,22.);}','#version 300 es\nprecision mediump float;uniform vec4 uC;out vec4 o;void main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.0,length(d));o=vec4(uC.rgb,uC.a*a);}');
var UD={uVP:gl.getUniformLocation(PD,'uVP'),uSz:gl.getUniformLocation(PD,'uSz'),uC:gl.getUniformLocation(PD,'uC')};
/* ---------------- textures ---------------- */
function mkCanvas(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c}
function tex(src,repeat){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);var w=repeat?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,w);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,w);if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,maxAn);return t}
function rnd(s){return function(){s=(s*16807)%2147483647;return s/2147483647}}
function proc(w,h,fn){var c=mkCanvas(w,h),x=c.getContext('2d');fn(x,w,h,rnd(7));return tex(c,true)}
var T={
 wood:proc(512,512,function(x,w,h,r){var pw=64;for(var i=0;i<w/pw;i++){var b=70+r()*30;x.fillStyle='rgb('+(b+40)+','+(b*.62|0)+','+(b*.32|0)+')';x.fillRect(i*pw,0,pw-2,h);for(var k=0;k<30;k++){x.strokeStyle='rgba(40,20,5,'+(r()*.18)+')';x.beginPath();var y=r()*h;x.moveTo(i*pw,y);x.bezierCurveTo(i*pw+20,y+8,i*pw+40,y-8,i*pw+pw,y+r()*6);x.stroke()}x.fillStyle='rgba(0,0,0,.35)';x.fillRect(i*pw+pw-2,0,2,h)}for(var j=0;j<4;j++){x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,j*128,w,2)}}),
 marble:proc(512,512,function(x,w,h,r){x.fillStyle='#d9d6cf';x.fillRect(0,0,w,h);for(var i=0;i<40;i++){x.strokeStyle='rgba(120,115,105,'+(.05+r()*.12)+')';x.lineWidth=.5+r()*2;x.beginPath();var a=r()*w,b=r()*h;x.moveTo(a,b);for(var k=0;k<5;k++){a+=(r()-.3)*120;b+=(r()-.5)*60;x.lineTo(a,b)}x.stroke()}x.fillStyle='rgba(0,0,0,.28)';x.fillRect(0,0,w,3);x.fillRect(0,0,3,h)}),
 conc:proc(256,256,function(x,w,h,r){x.fillStyle='#c9c9cc';x.fillRect(0,0,w,h);for(var i=0;i<1500;i++){x.fillStyle='rgba('+(r()<.5?255:0)+','+(r()<.5?255:0)+',255,.025)';x.fillRect(r()*w,r()*h,2,2)}x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,0,w,2);x.fillRect(0,0,2,h)}),
 gfloor:proc(256,256,function(x,w,h){x.fillStyle='#020912';x.fillRect(0,0,w,h);x.strokeStyle='rgba(56,249,255,.9)';x.lineWidth=2;x.strokeRect(1,1,w-2,h-2);x.strokeStyle='rgba(139,92,255,.45)';x.beginPath();x.moveTo(w/2,0);x.lineTo(w/2,h);x.moveTo(0,h/2);x.lineTo(w,h/2);x.stroke()}),
 paper:proc(256,512,function(x,w,h,r){x.fillStyle='#8c6a44';x.fillRect(0,0,w,h);for(var i=0;i<w;i+=32){x.fillStyle=i%64?'rgba(255,225,170,.10)':'rgba(0,0,0,.10)';x.fillRect(i,0,16,h*.62)}for(var k=0;k<60;k++){x.fillStyle='rgba(255,230,170,.18)';x.beginPath();x.arc(r()*w,r()*h*.6,2+r()*3,0,6.3);x.fill()}x.fillStyle='#4a2f16';x.fillRect(0,h*.62,w,h*.38);x.fillStyle='#c79a3b';x.fillRect(0,h*.62-3,w,5);x.strokeStyle='rgba(0,0,0,.4)';for(var j=0;j<w;j+=64){x.strokeRect(j+4,h*.66,56,h*.28)}}),
 plaster:proc(256,256,function(x,w,h,r){x.fillStyle='#d8d2c6';x.fillRect(0,0,w,h);for(var i=0;i<1200;i++){x.fillStyle='rgba(0,0,0,.025)';x.fillRect(r()*w,r()*h,3,3)}}),
 pwall:proc(256,512,function(x,w,h,r){var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#c9ccd6');g.addColorStop(.74,'#aeb2c0');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='#3a3d4f';x.fillRect(0,h*.78,w,h*.22);x.fillStyle='#ff4fa3';x.fillRect(0,h*.775,w,5);for(var i=0;i<1400;i++){x.fillStyle='rgba(0,0,0,.03)';x.fillRect(r()*w,r()*h,2,2)}x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,0,2,h)}),
 white:proc(128,128,function(x,w,h){x.fillStyle='#f3f1ee';x.fillRect(0,0,w,h);x.fillStyle='rgba(0,0,0,.04)';x.fillRect(0,0,w,1)}),
 dark:proc(128,128,function(x,w,h){x.fillStyle='#05101c';x.fillRect(0,0,w,h);x.strokeStyle='rgba(56,249,255,.55)';x.lineWidth=2;x.strokeRect(2,2,w-4,h-4)}),
 ceil:proc(64,64,function(x,w,h){x.fillStyle='#8c8a86';x.fillRect(0,0,w,h)}),
 glow:(function(){var c=mkCanvas(128,128),x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.5,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return tex(c,false)})()
};
function textTex(lines,w,h,o){o=o||{};var c=mkCanvas(w,h),x=c.getContext('2d');if(o.bg){x.fillStyle=o.bg;x.fillRect(0,0,w,h)}if(o.border){x.strokeStyle=o.border;x.lineWidth=6;x.strokeRect(3,3,w-6,h-6)}x.textAlign='center';x.textBaseline='middle';var y=h/2-(lines.length-1)*0.5*0,tot=0;lines.forEach(function(l){tot+=l.s*1.25});var cy=(h-tot)/2;lines.forEach(function(l){cy+=l.s*.625;x.font=(l.w||'700')+' '+l.s+'px '+(l.f||'Georgia,serif');x.fillStyle=l.c||'#fff';if(l.ls)x.letterSpacing=l.ls+'px';else x.letterSpacing='0px';var t=l.t;while(x.measureText(t).width>w-30&&l.s>14){l.s-=2;x.font=(l.w||'700')+' '+l.s+'px '+(l.f||'Georgia,serif')}x.fillText(t,w/2,cy);cy+=l.s*.625});return tex(c,false)}
function wrap(t,n){var w=t.split(' '),o=[],c='';w.forEach(function(x){if((c+' '+x).trim().length>n&&c){o.push(c);c=x}else c=(c+' '+x).trim()});o.push(c);return o}
/* ---------------- batches ---------------- */
var batches=[],byKey={};
function mat(key,o){if(byKey[key])return byKey[key];var b=o||{};b.key=key;b.col=b.col||[1,1,1];b.a=b.a==null?1:b.a;b.emi=b.emi||0;b.v=[];b.n=0;b.R=b.R;b.model=null;b.sph=null;byKey[key]=b;batches.push(b);return b}
function quad(m,p0,p1,p2,p3,ru,rv){var n=cross([p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],[p3[0]-p0[0],p3[1]-p0[1],p3[2]-p0[2]]);var l=Math.hypot(n[0],n[1],n[2])||1;n=[n[0]/l,n[1]/l,n[2]/l];ru=ru||1;rv=rv||1;var ps=[p0,p1,p2,p0,p2,p3],uv=[[0,0],[ru,0],[ru,rv],[0,0],[ru,rv],[0,rv]];var bb=m.bb||(m.bb=[1e9,1e9,1e9,-1e9,-1e9,-1e9]);for(var i=0;i<4;i++){var q=[p0,p1,p2,p3][i];for(var k=0;k<3;k++){if(q[k]<bb[k])bb[k]=q[k];if(q[k]>bb[k+3])bb[k+3]=q[k]}}for(var i=0;i<6;i++)m.v.push(ps[i][0],ps[i][1],ps[i][2],n[0],n[1],n[2],uv[i][0],uv[i][1])}
/* axis-aligned box from min/max corner */
function box(m,x0,y0,z0,x1,y1,z1,ru,rv){var A=[x0,y0,z0],B=[x1,y0,z0],C=[x1,y1,z0],Dd=[x0,y1,z0],E=[x0,y0,z1],F=[x1,y0,z1],G=[x1,y1,z1],H=[x0,y1,z1];
 quad(m,E,F,G,H,ru,rv);quad(m,B,A,Dd,C,ru,rv);quad(m,A,E,H,Dd,ru,rv);quad(m,F,B,C,G,ru,rv);quad(m,Dd,H,G,C,ru,rv);quad(m,A,B,F,E,ru,rv)}
function torus(m,R,r,sa,sb){for(var i=0;i<sa;i++){var a0=i/sa*6.2832,a1=(i+1)/sa*6.2832;for(var j=0;j<sb;j++){var b0=j/sb*6.2832,b1=(j+1)/sb*6.2832;function pt(a,b){var rr=R+r*Math.cos(b);return[rr*Math.cos(a),rr*Math.sin(a),r*Math.sin(b)]}quad(m,pt(a0,b0),pt(a1,b0),pt(a1,b1),pt(a0,b1))}}}
function octa(m,s){var p=[[s,0,0],[-s,0,0],[0,s,0],[0,-s,0],[0,0,s],[0,0,-s]];var f=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];f.forEach(function(t){var a=p[t[0]],b=p[t[1]],c=p[t[2]];var n=cross([b[0]-a[0],b[1]-a[1],b[2]-a[2]],[c[0]-a[0],c[1]-a[1],c[2]-a[2]]);var l=Math.hypot(n[0],n[1],n[2]);[a,b,c].forEach(function(q,i){m.v.push(q[0],q[1],q[2],n[0]/l,n[1]/l,n[2]/l,i/2,i%2)})})}
function build(){batches.forEach(function(b){if(b.vao)return;if(b.R||!b.bb)b.nocull=1;else{b.cx=(b.bb[0]+b.bb[3])/2;b.cy=(b.bb[1]+b.bb[4])/2;b.cz=(b.bb[2]+b.bb[5])/2;b.rad=Math.hypot(b.bb[3]-b.bb[0],b.bb[4]-b.bb[1],b.bb[5]-b.bb[2])/2}var d=new Float32Array(b.v);b.n=d.length/8;b.vao=gl.createVertexArray();gl.bindVertexArray(b.vao);var vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);[['aP',3,0],['aN',3,12],['aT',2,24]].forEach(function(a,i){var loc=gl.getAttribLocation(P,a[0]);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,a[1],gl.FLOAT,false,32,a[2])});b.v=null})}
/* Animated exhibits are modeled in local space, with explicit world anchors. */
var SCENE_ACTORS=[],SCENE_EXHIBITS=[],motionEnabled=true;
function sceneGroup(key,color,root,options){var m=mat('scene-'+key,Object.assign({col:color,emi:.25},options||{}));m.R=root;return m}
function cyl(m,r,h,n){n=n||16;for(var j=0;j<n;j++){var a=j/n*Math.PI*2,b=(j+1)/n*Math.PI*2;quad(m,[Math.cos(a)*r,-h/2,Math.sin(a)*r],[Math.cos(b)*r,-h/2,Math.sin(b)*r],[Math.cos(b)*r,h/2,Math.sin(b)*r],[Math.cos(a)*r,h/2,Math.sin(a)*r]);quad(m,[0,h/2,0],[Math.cos(a)*r,h/2,Math.sin(a)*r],[Math.cos(b)*r,h/2,Math.sin(b)*r],[0,h/2,0])}}
function livingDisplay(era,W,A,L,uc,i){
 var side=i%2?-1:1,c=W(uc,side*2.8),yaw=Math.atan2(-L[0]*side,-L[1]*side),key=era+'-'+i;
 var anchor=function(t){return mul(trans(c[0],1.15,c[1]),rotY(yaw))};
 var pedestal=mat('scene-pedestal-'+era,{col:era==='past'?[.25,.15,.08]:era==='present'?[.72,.73,.69]:[.035,.07,.11],tex:era==='past'?T.wood:null,emi:.2});box(pedestal,c[0]-.72,0,c[1]-.72,c[0]+.72,.85,c[1]+.72);collide(c[0]-.78,c[1]-.78,c[0]+.78,c[1]+.78);
 var titles={past:['CRT television · 2003','Cassette player · 2000s','Portable radio · 2000s','Karaoke microphone','Electric fan','Keypad phone'],present:['Smartphone','Cashless payment terminal','Everyday laptop','Wireless headphones','Solar-powered living','Game controller'],future:['Hover transport concept','Autonomous survey drone','Encrypted archive','Hover transport concept','Orbital observatory','Quantum archive concept']};
 var label=sceneGroup(key+'label',[1,1,1],anchor,{tex:textTex([{t:titles[era][i],s:36,c:era==='future'?'#9deeff':'#efe3c5',f:'monospace'}],700,130,{bg:era==='future'?'#081724':'#293029'}),emi:.85});quad(label,[-.7,-.95,.73],[.7,-.95,.73],[.7,-.69,.73],[-.7,-.69,.73]);
 SCENE_EXHIBITS.push({era:era,room:i,kind:titles[era][i],anchor:c});if(era==='future'&&(i===2||i===4||i===5))PICK.push({hub:'mystery',clue:i,c:[c[0],1.9,c[1]],r:1.1,kind:'hub',label:'Investigate: '+titles[era][i]});
 var body=sceneGroup(key+'body',era==='past'?[.12,.12,.11]:era==='present'?[.12,.15,.17]:[.09,.17,.24],anchor),trim=sceneGroup(key+'trim',era==='past'?[.65,.57,.39]:[.65,.72,.75],anchor);
 function screen(text,bg,fg,x0,y0,x1,y1,z){var m=sceneGroup(key+'screen',[1,1,1],anchor,{tex:textTex(text.map(function(t){return{t:t,s:48,c:fg,f:'monospace'}}),512,384,{bg:bg}),emi:.8});quad(m,[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]);return m}
 if(era==='past'){
  if(i===0){box(body,-.64,-.25,-.35,.64,.65,.3);box(trim,-.58,-.18,.31,.45,.58,.35);screen(['2003','NO SIGNAL'],'#314e41','#a6e0ac',-.51,-.11,.38,.51,.36);box(trim,.5,-.12,.33,.57,.05,.39);box(trim,.5,.18,.33,.57,.35,.39);var antenna=sceneGroup(key+'antenna',[.7,.7,.65],anchor);box(antenna,-.02,.65,-.02,.02,1.18,.02);var sweep=sceneGroup(key+'scan',[.4,.9,.55],function(t){return mul(anchor(t),trans(0,Math.sin(t*.7)*.27,0))},{emi:.5,a:.25});quad(sweep,[-.49,.1,.365],[.36,.1,.365],[.36,.12,.365],[-.49,.12,.365]);}
  else if(i===1){box(body,-.65,-.2,-.3,.65,.5,.3);box(trim,-.57,.12,.31,.57,.45,.34);[-.28,.28].forEach(function(x,j){var reel=sceneGroup(key+'reel'+j,[.75,.72,.6],function(t){return mul(anchor(t),mul(trans(x,.28,.37),rotZ(t*(j?1:-1)*.7)))});torus(reel,.12,.025,20,5);box(reel,-.015,-.01,-.1,.015,.01,.1)});for(var b=0;b<5;b++)box(trim,-.5+b*.22,-.08,.32,-.34+b*.22,.02,.39);}
  else if(i===2){box(body,-.55,-.2,-.25,.55,.55,.25);for(var row=0;row<5;row++)box(trim,-.47,-.07+row*.1,.26,-.05,-.05+row*.1,.28);screen(['FM 97.1'],'#6a7253','#e0e6b1',.05,.19,.45,.43,.26);box(trim,.38,.55,-.1,.4,1.35,-.08);var dial=sceneGroup(key+'dial',[.7,.6,.35],function(t){return mul(anchor(t),mul(trans(.28,.01,.31),rotZ(Math.sin(t*.4)*.5)))});box(dial,-.07,-.07,-.02,.07,.07,.04);}
  else if(i===3){box(trim,-.28,-.3,-.28,.28,-.24,.28);box(body,-.025,-.25,-.025,.025,.4,.025);var mic=sceneGroup(key+'mic',[.65,.66,.63],function(t){return mul(anchor(t),mul(trans(0,.63,0),rotZ(Math.sin(t*.5)*.1)))});box(mic,-.065,-.22,-.065,.065,.13,.065);var cap=sceneGroup(key+'mic-head',[.25,.27,.28],mic.R);box(cap,-.12,.13,-.12,.12,.38,.12);}
  else if(i===4){box(body,-.3,-.3,-.25,.3,-.23,.25);box(trim,-.04,-.23,-.04,.04,.45,.04);var fanroot=function(t){return mul(anchor(t),trans(0,.68,0))};var guard=sceneGroup(key+'fan-guard',[.55,.57,.54],fanroot);torus(guard,.42,.025,32,5);var rotor=sceneGroup(key+'fan-rotor',[.4,.65,.57],function(t){return mul(anchor(t),mul(trans(0,.68,.015),rotZ(t*3)))});for(var f=0;f<3;f++){var a=f*Math.PI*2/3,ux=Math.cos(a),uy=Math.sin(a);quad(rotor,[0,0,0],[ux*.41-uy*.12,uy*.41+ux*.12,0],[ux*.41+uy*.1,uy*.41-ux*.1,0],[ux*.1,uy*.1,0])}}
  else{box(body,-.22,-.28,-.12,.22,.76,.12);screen(['12:45','1 message'],'#769550','#263b25',-.17,.25,.17,.65,.13);for(var row=0;row<4;row++)for(var col=0;col<3;col++)box(trim,-.16+col*.115,-.2+row*.09,.125,-.08+col*.115,-.14+row*.09,.15);}
 }else if(era==='present'){
  if(i===0||i===1){box(body,-.28,-.24,-.075,.28,.79,.075);screen(i===0?['Connected','11:24']:['PAY WITH QR','▦'],'#152f38','#a6e1d5',-.235,-.18,.235,.7,.08);box(trim,-.07,-.22,.08,.07,-.2,.09)}
  else if(i===2){box(body,-.65,-.3,-.36,.65,-.24,.36);box(trim,-.59,-.235,-.25,.59,-.22,.23);box(body,-.64,-.24,-.34,.64,.6,-.27);screen(['Digital','everyday'],'#1b3542','#c9e7ec',-.58,-.15,.58,.54,-.26)}
  else if(i===3){var band=sceneGroup(key+'headband',[.72,.75,.77],function(t){return mul(anchor(t),trans(0,.25,0))});torus(band,.36,.05,24,6);box(body,-.45,-.02,-.15,-.26,.35,.15);box(body,.26,-.02,-.15,.45,.35,.15)}
  else if(i===4){box(trim,-.65,-.22,-.4,.65,-.16,.4);var panel=sceneGroup(key+'solar',[.04,.14,.26],anchor);box(panel,-.6,-.15,-.36,.6,-.12,.36);for(var x=0;x<4;x++)box(trim,-.56+x*.3,-.11,-.36,-.55+x*.3,-.1,.36);box(trim,-.6,-.11,-.01,.6,-.1,.01);var sun=sceneGroup(key+'energy',[.6,.85,.55],function(t){return mul(anchor(t),mul(trans(0,.48,0),rotY(t*.35)))},{emi:.8});octa(sun,.2)}
  else{box(body,-.48,-.06,-.2,.48,.19,.2);box(body,-.53,-.23,-.16,-.26,.04,.16);box(body,.26,-.23,-.16,.53,.04,.16);box(trim,-.33,.2,-.08,-.12,.24,-.01);box(trim,-.26,.2,-.15,-.19,.24,.06);var buttons=sceneGroup(key+'buttons',[.25,.65,.48],anchor);box(buttons,.21,.2,-.12,.29,.25,-.04);box(buttons,.31,.2,.02,.39,.25,.1)}
 }else{
  // Concepts float above recessed display plinths. The central walkway stays open.
  if(i===0||i===3){var carRoot=function(t){var p=W(uc+Math.sin(t*.24+i)*1.8,side*2.8);return mul(trans(p[0],1.35+Math.sin(t*.8+i)*.09,p[1]),rotY(Math.atan2(A[0],A[1])))};body.R=carRoot;trim.R=carRoot;box(body,-.58,-.13,-1.17,.58,.2,1.17);box(body,-.48,.2,-.7,.48,.32,.75);var glass=sceneGroup(key+'canopy',[.12,.55,.65],carRoot,{emi:.4});quad(glass,[-.42,.3,-.65],[.42,.3,-.65],[.34,.68,-.1],[-.34,.68,-.1]);quad(glass,[-.34,.68,-.1],[.34,.68,-.1],[.4,.3,.65],[-.4,.3,.65]);quad(glass,[-.42,.3,-.65],[-.34,.68,-.1],[-.4,.3,.65],[-.42,.3,.65]);quad(glass,[.42,.3,.65],[.4,.3,.65],[.34,.68,-.1],[.42,.3,-.65]);var lamps=sceneGroup(key+'headlights',[.6,.95,1],carRoot,{emi:1});box(lamps,-.5,.04,1.175,-.2,.1,1.19);box(lamps,.2,.04,1.175,.5,.1,1.19);[-1,1].forEach(function(x){[-1,1].forEach(function(z){var jet=sceneGroup(key+'hover'+x+z,[.2,.85,1],function(t){return mul(carRoot(t),mul(trans(x*.46,-.16,z*.8),rotX(Math.PI/2)))},{emi:1});torus(jet,.18,.035,16,5)})});}
  else if(i===1){var droneRoot=function(t){return mul(anchor(t),mul(trans(Math.sin(t*.45)*.45,.5+Math.sin(t*.8)*.2,0),rotY(t*.25)))};body.R=droneRoot;box(body,-.25,0,-.25,.25,.2,.25);box(trim,-.6,.06,-.04,.6,.1,.04);trim.R=droneRoot;[-1,1].forEach(function(x){[-1,1].forEach(function(z){var rotor=sceneGroup(key+'rotor'+x+z,[.25,.8,.9],function(t){return mul(droneRoot(t),mul(trans(x*.55,.12,z*.45),rotY(t*4)))},{emi:.6});box(rotor,-.25,-.012,-.025,.25,.012,.025)})});}
  else{var root=function(t){return mul(anchor(t),mul(trans(0,.6+Math.sin(t*.65+i)*.12,0),mul(rotY(t*.23+i),rotZ(.3))))};body.R=root;octa(body,.45);var halo=sceneGroup(key+'halo',[.15,.8,1],function(t){return mul(root(t),rotX(Math.PI/2))},{emi:1});torus(halo,.68,.025,32,5);var core=sceneGroup(key+'light',[.65,.38,1],root,{emi:1});octa(core,.2);}
 }
}
function visitor(era,W,A,L,uc,side,seed){
 var actor={era:era,lastT:-1,position:[0,0],walking:false};
 actor.pose=function(t){if(actor.lastT===t)return actor.root;actor.lastT=t;var phase=(t*.13+seed)%6,u,v,du=0,dv=0;
  if(phase<1){u=uc-2+phase*2;v=side*(4.4+phase);du=2;dv=side}
  else if(phase<2.5){u=uc;v=side*5.4}
  else if(phase<3.5){u=uc+(phase-2.5)*2;v=side*(5.4-(phase-2.5));du=2;dv=-side}
  else if(phase<4){u=uc+2;v=side*4.4}
  else{u=uc+2-(phase-4)*2;v=side*4.4;du=-2}
  var p=W(u,v),dir=du||dv?[A[0]*du+L[0]*dv,A[1]*du+L[1]*dv]:[L[0]*side,L[1]*side];actor.position=p;actor.walking=!!(du||dv);var yaw=Math.atan2(-dir[0],-dir[1]);actor.root=mul(trans(p[0],0,p[1]),rotY(yaw));return actor.root};
 SCENE_ACTORS.push(actor);var id='visitor-'+era+'-'+seed,root=function(t){return actor.pose(t)},skin=sceneGroup(id+'skin',seed%2?[.58,.36,.23]:[.77,.56,.39],root),shirt=sceneGroup(id+'shirt',era==='future'?[.2,.35,.45]:seed%2?[.3,.42,.32]:[.65,.47,.26],root),hair=sceneGroup(id+'hair',[.08,.065,.055],root);
 box(shirt,-.21,.77,-.13,.21,1.3,.13);box(skin,-.14,1.34,-.13,.14,1.65,.13);box(hair,-.15,1.6,-.14,.15,1.72,.14);box(hair,-.15,1.43,.09,.15,1.67,.16);var face=sceneGroup(id+'eyes',[.08,.07,.06],root);box(face,-.09,1.5,-.139,-.045,1.53,-.13);box(face,.045,1.5,-.139,.09,1.53,-.13);
 [-1,1].forEach(function(side){var leg=sceneGroup(id+'leg'+side,[.15,.19,.22],function(t){var r=root(t),a=actor.walking?Math.sin(t*4+seed)*.28*side:0;return mul(r,mul(trans(side*.115,.79,0),rotX(a)))});box(leg,-.08,-.72,-.09,.08,0,.09);box(leg,-.085,-.78,-.18,.085,-.7,.1);var arm=sceneGroup(id+'arm'+side,seed%2?[.3,.42,.32]:[.65,.47,.26],function(t){var r=root(t),a=actor.walking?-Math.sin(t*4+seed)*.22*side:-.15;return mul(r,mul(trans(side*.28,1.24,0),rotX(a)))});box(arm,-.065,-.47,-.065,.065,.03,.065)});
 actor.pose(0);
}
function populateGallery(era,W,A,L,uc,i){livingDisplay(era,W,A,L,uc,i);if(era==='present'||i===1||i===4)visitor(era,W,A,L,uc,i%2?1:-1,i+1)}

/* ---------------- world layout ---------------- */
var COL=[],LIGHTS=[],PICK=[],STN=[],ZONES=[];
function collide(x0,z0,x1,z1){COL.push([Math.min(x0,x1),Math.min(z0,z1),Math.max(x0,x1),Math.max(z0,z1)])}
var HW=15,HH=9,WW=8,WH=5.2,BAY=14,V0=8,DOOR=3,DH=4.8;
var ERAC={hall:{amb:[.46,.45,.44],fog:[.07,.07,.09],fd:.016,bg:[.05,.05,.07]},past:{amb:[.42,.30,.19],fog:[.09,.06,.035],fd:.026,bg:[.07,.045,.025]},present:{amb:[.26,.26,.30],fog:[.34,.33,.40],fd:.014,bg:[.34,.33,.40]},future:{amb:[.09,.15,.22],fog:[.008,.02,.04],fd:.035,bg:[.01,.03,.07]},game:{amb:[.24,.12,.34],fog:[.05,.02,.1],fd:.024,bg:[.05,.02,.1]}};
var LC={hall:[1,.92,.8],past:[1,.72,.38],present:[.95,.92,.88],future:[.3,.9,1],game:[1,.4,.9]};
var SK={
 past:{wall:'paper',floor:'wood',ceil:'#',frame:[.78,.58,.2],fa:'wood',wash:[1,.78,.45],plq:'#f1e4c6',plqt:'#2a1a10',blade:'wood'},
 present:{wall:'pwall',floor:'conc',frame:[.96,.96,.96],wash:[1,.95,.9],plq:'#ffffff',plqt:'#111',blade:'pwall'},
 future:{wall:'dark',floor:'gfloor',frame:[.2,.95,1],wash:[.2,.9,1],plq:'#031321',plqt:'#8ff',blade:'dark'}};
function addWing(id,O,A,L,nb){
 var era=id,len=V0+nb*BAY+4,sk=SK[era];
 function W(u,v){return[O[0]+A[0]*u+L[0]*v,O[1]+A[1]*u+L[1]*v]}
 function bx(m,u0,v0,u1,v1,y0,y1,ru,rv,col){var a=W(u0,v0),b=W(u1,v1);box(m,Math.min(a[0],b[0]),y0,Math.min(a[1],b[1]),Math.max(a[0],b[0]),y1,Math.max(a[1],b[1]),ru,rv)}
 function cl(u0,v0,u1,v1){var a=W(u0,v0),b=W(u1,v1);collide(a[0],a[1],b[0],b[1])}
 var wallM=mat(era+'wall',{tex:T[sk.wall],emi:era==='present'?.04:era==='future'?.2:.18});
 var floorM=mat(era+'floor',{col:era==='present'?[.62,.62,.7]:[1,1,1],tex:T[sk.floor],a:era==='past'?1:era==='present'?.8:.62,floor:1,emi:era==='future'?.35:.06});
 var ceilM=mat(era+'ceil',{tex:T.ceil,col:era==='future'?[.04,.1,.16]:era==='present'?[.3,.31,.38]:[.5,.38,.28],emi:.1});
 /* floor and ceiling */
 var f0=W(0,-WW),f1=W(len,WW);var fx0=Math.min(f0[0],f1[0]),fx1=Math.max(f0[0],f1[0]),fz0=Math.min(f0[1],f1[1]),fz1=Math.max(f0[1],f1[1]);
 var rpt=era==='past'?[(fx1-fx0)/6,(fz1-fz0)/6]:[(fx1-fx0)/4,(fz1-fz0)/4];
 quad(floorM,[fx0,0,fz1],[fx1,0,fz1],[fx1,0,fz0],[fx0,0,fz0],rpt[0],rpt[1]);
 quad(ceilM,[fx0,WH,fz0],[fx1,WH,fz0],[fx1,WH,fz1],[fx0,WH,fz1],4,4);
 /* walls */
 var th=.4;bx(wallM,0,-WW-th,len,-WW,0,WH,len/4,1);bx(wallM,0,WW,len,WW+th,0,WH,len/4,1);bx(wallM,len,-WW,len+th,WW,0,WH,4,1);
 cl(0,-WW-th,len,-WW);cl(0,WW,len,WW+th);cl(len,-WW,len+th,WW);
 var accent=mat(era+'acc',{col:sk.frame,emi:1});
 /* entrance gate */
 if(era==='past'){var pm=mat('pastpillar',{tex:T.wood,col:[.9,.7,.5],emi:.2});bx(pm,1.5,-3.4,2.4,-2.6,0,WH-.8,1,1);bx(pm,1.5,2.6,2.4,3.4,0,WH-.8,1,1);bx(pm,1.5,-3.4,2.4,3.4,WH-1.4,WH-.8,3,1);cl(1.5,-3.4,2.4,-2.6);cl(1.5,2.6,2.4,3.4)}
 if(era==='present'){var gate=mat('present-entry',{col:[.7,.74,.69],emi:.2});bx(gate,2,-3.5,2.3,-3.1,0,WH,1,1);bx(gate,2,3.1,2.3,3.5,0,WH,1,1);bx(gate,2,-3.5,2.3,3.5,WH-.35,WH,1,1)}
 if(era==='future'){['t1','t2','t3'].forEach(function(k,i){var m=mat('tm'+k,{col:[[.2,.95,1],[.55,.4,1],[1,.7,.2]][i],emi:1});m.R=function(t){var c=W(4,0);var r=i===0?rotX(t*1.2):i===1?rotY(t*1.5):rotZ(t*1.9);return mul(trans(c[0],2.6,c[1]),mul(rotY(A[0]?Math.PI/2:0),r))};torus(m,2.7-i*.5,.06,56,6)})}
 /* bays */
 for(var i=0;i<nb;i++){var u0=V0+i*BAY,uc=u0+BAY/2;
  var room=D.eras[era].rooms[i];if(!room)continue;
  var stn={era:era,idx:i,room:room,u0:u0,uc:uc,pos:W(u0-.5,0),yaw:Math.atan2(-A[0],-A[1])};STN.push(stn);ZONES.push({era:era,room:i,x0:Math.min(W(u0,-WW)[0],W(u0+BAY,WW)[0]),x1:Math.max(W(u0,-WW)[0],W(u0+BAY,WW)[0]),z0:Math.min(W(u0,-WW)[1],W(u0+BAY,WW)[1]),z1:Math.max(W(u0,-WW)[1],W(u0+BAY,WW)[1]),stn:stn});
  /* ceiling lights + point light */
  var lp=W(uc,0);LIGHTS.push({p:[lp[0],WH-.8,lp[1]],c:LC[era],r:era==='future'?16:20});LIGHTS.push({p:[W(uc,-4.5)[0],WH-.8,W(uc,-4.5)[1]],c:LC[era],r:14});LIGHTS.push({p:[W(uc,4.5)[0],WH-.8,W(uc,4.5)[1]],c:LC[era],r:14});
  var lm=mat(era+'lamp',{col:era==='past'?[1,.85,.55]:era==='future'?[.3,.95,1]:[1,1,1],emi:1});bx(lm,uc-3,-.35,uc+3,.35,WH-.05,WH,1,1);bx(lm,uc-3,-4.85,uc+3,-4.15,WH-.05,WH,1,1);bx(lm,uc-3,4.15,uc+3,4.85,WH-.05,WH,1,1);
  var PAL=[[1,.31,.64],[.15,.88,1],[1,.69,.18],[.55,.36,1],[.18,.9,.65],[1,.42,.24]],pc=PAL[i%6];
  /* floor stripe */
  var sm=mat(era+'stripe',{col:sk.frame,emi:.8});var s0=W(u0,-WW),s1=W(u0+.12,WW);quad(sm,[Math.min(s0[0],s1[0]),.012,Math.max(s0[1],s1[1])],[Math.max(s0[0],s1[0]),.012,Math.max(s0[1],s1[1])],[Math.max(s0[0],s1[0]),.012,Math.min(s0[1],s1[1])],[Math.min(s0[0],s1[0]),.012,Math.min(s0[1],s1[1])]);
  /* station signs */
  var yrs=room.yrs;var sg=mat('sgn-'+era+i,{tex:textTex([{t:'ROOM '+room.num,s:30,c:era==='present'?'#ff4fa3':era==='future'?'#38f9ff':'#e6c773',f:'monospace',ls:6},{t:room.name.toUpperCase(),s:96,c:era==='present'?'#161225':'#fff',f:era==='future'?'Orbitron,Arial Black,sans-serif':era==='present'?'Sora,Arial Black,sans-serif':'Playfair Display,Georgia,serif'},{t:yrs,s:32,c:era==='present'?'#444':'#d0c8b8',f:'monospace'}],1024,420,{bg:era==='present'?'rgba(255,255,255,.96)':era==='future'?'rgba(2,12,24,.85)':'#2a1a0e',border:era==='past'?'#c79a3b':era==='future'?'#38f9ff':'#ff4fa3'}),emi:.95});
  var s2=W(u0+.35,-3.2),s3=W(u0+.35,3.2);
  quad(sg,[s2[0]-A[0]*.04,3.3,s2[1]-A[1]*.04].map(function(x){return x}),[s3[0]-A[0]*.04,3.3,s3[1]-A[1]*.04],[s3[0]-A[0]*.04,4.9,s3[1]-A[1]*.04],[s2[0]-A[0]*.04,4.9,s2[1]-A[1]*.04]);
  quad(sg,[s3[0]+A[0]*.04,3.3,s3[1]+A[1]*.04],[s2[0]+A[0]*.04,3.3,s2[1]+A[1]*.04],[s2[0]+A[0]*.04,4.9,s2[1]+A[1]*.04],[s3[0]+A[0]*.04,4.9,s3[1]+A[1]*.04]);
  populateGallery(era,W,A,L,uc,i);
  /* Keep the entire walking aisle open: photographs belong on perimeter walls. */
  var art=room.items.filter(function(x){return x.kind==='art'});
  [-1,1].forEach(function(side){
   var wallItems=art.filter(function(x,k){return k%2===(side===-1?0:1)});
   wallItems.forEach(function(item,k){
    var u=wallItems.length===1?uc:u0+1.4+(BAY-2.8)*(k+.5)/wallItems.length;
    var width=Math.min(3.5,(BAY-2.8)/wallItems.length-.45);
    placeArt(era,W,L,A,[u,side*(WW-.06),-side,width,width*.75,2.4],item,sk,k);
   });
  });
 }
 /* end wall sign */
 var es=mat('end'+era,{tex:textTex([{t:'END OF THE '+era.toUpperCase()+' WING',s:60,c:'#fff'},{t:'Turn back to the Grand Hall',s:34,c:'#bbb',f:'monospace'}],1024,300,{bg:'rgba(0,0,0,.5)'}),emi:.9});var e0=W(len-.05,-3),e1=W(len-.05,3);quad(es,[e0[0],2,e0[1]],[e1[0],2,e1[1]],[e1[0],4,e1[1]],[e0[0],4,e0[1]])
}
function placeArt(era,W,L,A,s,item,sk,k){
 var u=s[0],v=s[1],sg=s[2],w=s[3],h=s[4],y=s[5],c=W(u,v),N=[L[0]*sg,0,L[1]*sg],R=cross([0,1,0],N);
 var off=era==='future'?.28:.02;var cx=c[0]+N[0]*off,cz=c[2]!==undefined?0:c[1]+N[2]*off;cz=c[1]+N[2]*off;
 var hw=w/2,hh=h/2;
 function pt(a,b,o){return[cx+R[0]*a+N[0]*(o||0),y+b,cz+R[2]*a+N[2]*(o||0)]}
 var m=mat('art-'+item.id,{tex:textTex([{t:'THE ARCHIVE',s:36,c:'#69735c',f:'monospace'},{t:item.title,s:46,c:'#303c2c'}],800,600,{bg:'#e5e0d5'}),col:[1,1,1],emi:era==='future'?.8:era==='present'?.42:.6,scan:era==='future'?.5:0});m.item=item;item.mat=m;item.displayCenter=[cx,cz];
 quad(m,pt(-hw,-hh,.012),pt(hw,-hh,.012),pt(hw,hh,.012),pt(-hw,hh,.012));
 var fw=era==='past'?.16:era==='present'?.05:.04;var fm=mat(era+'frm',{col:sk.frame,emi:era==='future'?1:.25});
 [[-hw-fw,hh,hw+fw,hh+fw],[-hw-fw,-hh-fw,hw+fw,-hh],[-hw-fw,-hh,-hw,hh],[hw,-hh,hw+fw,hh]].forEach(function(q){quad(fm,pt(q[0],q[1],.0),pt(q[2],q[1],.0),pt(q[2],q[3],.0),pt(q[0],q[3],.0))});
 /* backing + depth for frame */
 var back=mat(era+'back',{col:era==='future'?[.0,.3,.4]:era==='past'?[.25,.15,.05]:[.8,.8,.8],emi:.3});quad(back,pt(-hw-fw,-hh-fw,-.01),pt(hw+fw,-hh-fw,-.01),pt(hw+fw,hh+fw,-.01),pt(-hw-fw,hh+fw,-.01));
 /* wash light */
 var wm=mat(era+'wash',{tex:T.glow,col:sk.wash,emi:1,add:1,a:.55});var ww=w*1.9,wh=h*1.9;quad(wm,pt(-ww/2,-wh/2+.1,-.004),pt(ww/2,-wh/2+.1,-.004),pt(ww/2,wh/2+.1,-.004),pt(-ww/2,wh/2+.1,-.004));
 /* plaque */
 var pm=mat('plq-'+item.id,{tex:textTex([{t:item.label,s:26,c:sk.plqt,f:'monospace',ls:2,w:'400'}].concat(wrap(item.title,34).slice(0,2).map(function(t){return{t:t,s:44,c:sk.plqt,f:era==='future'?'Orbitron,Arial,sans-serif':'Georgia,serif'}})),640,190,{bg:sk.plq,border:era==='past'?'#c79a3b':era==='future'?'#38f9ff':'#ff4fa3'}),emi:era==='present'?.5:.9});
 quad(pm,pt(-.7,-hh-fw-.5,.01),pt(.7,-hh-fw-.5,.01),pt(.7,-hh-fw-.1,.01),pt(-.7,-hh-fw-.1,.01));
 /* pick plane */
 PICK.push({item:item,c:[cx,y,cz],R:R,N:N,hw:hw+fw,hh:hh+fw,kind:'art'});
 /* spot fixture */
 var fx=mat('fix',{col:[.1,.1,.1],emi:.2});box(fx,cx+N[0]*1.2-.08,WH-.2,cz+N[2]*1.2-.08,cx+N[0]*1.2+.08,WH,cz+N[2]*1.2+.08);
}
function placeStele(era,W,L,A,u,item,sk){
 var c=W(u,0),rows=item.rows.slice(0,6),ac=era==='present'?'#ff4fa3':era==='future'?'#38f9ff':'#c79a3b',fg=era==='present'?'#161225':'#fff',bg=era==='present'?'#ffffff':era==='future'?'#031321':'#2a1a0e';
 var cvs=mkCanvas(1024,640),x=cvs.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,1024,640);x.strokeStyle=ac;x.lineWidth=8;x.strokeRect(4,4,1016,632);x.fillStyle=ac;x.font='700 34px monospace';x.textAlign='left';x.fillText('FACTS AT A GLANCE  ·  PRESS E',34,64);
 rows.forEach(function(r,i){var cx=34+(i%2)*490,cy=96+Math.floor(i/2)*178;x.strokeStyle=ac;x.lineWidth=3;x.strokeRect(cx,cy,470,160);x.fillStyle=ac;x.font='700 24px monospace';x.fillText(String(r[0]).toUpperCase().slice(0,26),cx+14,cy+36);x.fillStyle=fg;x.font='700 30px Georgia,serif';wrap(String(r[1]),24).slice(0,3).forEach(function(t,k){x.fillText(t,cx+14,cy+80+k*36)})});
 var m=mat('stele-'+item.id,{tex:tex(cvs,false),emi:era==='present'?.2:.95});item.mat=null;
 var bm=mat(era+'stelebody',{col:era==='past'?[.35,.2,.1]:era==='future'?[.02,.1,.16]:[.9,.9,.9],emi:.4});
 var hw=1.5,hh=.94,y=2.15,dx=A[0]?0:1,dz=A[0]?1:0;
 function Q(sg){var n=[A[0]*sg,A[1]*sg],o=.09*sg,px=c[0]+A[0]*o,pz=c[1]+A[1]*o,r=[-A[1]*-sg*0,0];var R=cross([0,1,0],[n[0],0,n[1]]);quad(m,[px-R[0]*hw,y-hh,pz-R[2]*hw],[px+R[0]*hw,y-hh,pz+R[2]*hw],[px+R[0]*hw,y+hh,pz+R[2]*hw],[px-R[0]*hw,y+hh,pz-R[2]*hw]);return n}
 var n1=Q(-1);Q(1);box(bm,c[0]-(A[0]?.08:hw+.05),0,c[1]-(A[0]?hw+.05:.08),c[0]+(A[0]?.08:hw+.05),y-hh,c[1]+(A[0]?hw+.05:.08));
 box(bm,c[0]-(A[0]?.08:hw+.05),y+hh,c[1]-(A[0]?hw+.05:.08),c[0]+(A[0]?.08:hw+.05),y+hh+.06,c[1]+(A[0]?hw+.05:.08));
 collide(c[0]-(A[0]?.15:hw),c[1]-(A[0]?hw:.15),c[0]+(A[0]?.15:hw),c[1]+(A[0]?hw:.15));
 PICK.push({item:item,c:[c[0],y,c[1]],r:2.2,kind:'cube'});
}
function placeCube(era,W,uc,item,sk,i){
 var c=W(uc,0);var pm=mat(era+'ped',{tex:era==='past'?T.wood:null,col:era==='past'?[.8,.55,.35]:era==='present'?[.95,.95,.95]:[.03,.12,.18],emi:era==='future'?.5:.25});
 box(pm,c[0]-.55,0,c[1]-.55,c[0]+.55,.95,c[1]+.55,1,1);collide(c[0]-.6,c[1]-.6,c[0]+.6,c[1]+.6);
 var rim=mat(era+'acc',{col:sk.frame,emi:1});box(rim,c[0]-.58,.95,c[1]-.58,c[0]+.58,.99,c[1]+.58);
 var m=mat('cube-'+item.id,{col:[.15,.15,.18],emi:.9});m.item=item;item.mat=m;var s=.42;
 var P=function(x,y,z){return[x*s,y*s,z*s]};var fa=[[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]];
 fa.forEach(function(f){quad(m,P.apply(0,f[0]),P.apply(0,f[1]),P.apply(0,f[2]),P.apply(0,f[3]))});
 var cy=1.7;m.R=function(t){return mul(trans(c[0],cy+Math.sin(t*1.4)*.08,c[1]),rotY(t*.6))};
 var gm=mat(era+'cglow',{tex:T.glow,col:sk.wash,emi:1,add:1,a:.7});quad(gm,[c[0]-1.4,.03,c[1]+1.4],[c[0]+1.4,.03,c[1]+1.4],[c[0]+1.4,.03,c[1]-1.4],[c[0]-1.4,.03,c[1]-1.4]);
 var lb=mat('clb-'+item.id,{tex:textTex([{t:'FEATURED',s:26,c:sk.plqt,f:'monospace',ls:3,w:'400'}].concat(wrap(item.title,30).slice(0,2).map(function(t){return{t:t,s:44,c:sk.plqt}})),640,190,{bg:sk.plq,border:'#999'}),emi:.9});
 var q=[c[0]-.7,0,c[1]+.62];quad(lb,[q[0],.28,q[2]+.0],[q[0]+1.4,.28,q[2]],[q[0]+1.4,.62,q[2]],[q[0],.62,q[2]]);
 PICK.push({item:item,c:[c[0],cy,c[1]],r:.8,kind:'cube'});
 if(era==='future'){var hm=mat('holo'+i,{col:[.3,.95,1],emi:1,add:1,a:.35});hm.R=function(t){return mul(trans(c[0],cy,c[1]),mul(rotY(-t*.5),rotX(t*.3)))};octa(hm,.75)}
}
function decor(era,W,uc,sk){
 [-5.2,5.2].forEach(function(v,j){var c=W(uc+(j?2:-2),v);
  if(era==='past'){var wm=mat('stand',{tex:T.wood,col:[.7,.5,.3],emi:.2}),cm=mat('crt',{col:[.9,.8,.6],emi:.8});box(wm,c[0]-.45,0,c[1]-.45,c[0]+.45,.9,c[1]+.45);box(wm,c[0]-.4,.9,c[1]-.35,c[0]+.4,1.45,c[1]+.35);box(cm,c[0]-.3,.95,c[1]-.37,c[0]+.3,1.38,c[1]-.34);collide(c[0]-.5,c[1]-.5,c[0]+.5,c[1]+.5)}
  else if(era==='present'){var pm=mat('plint',{col:[.97,.97,.97],emi:.35}),sm=mat('scr',{col:[.3,.8,1],emi:1});box(pm,c[0]-.3,0,c[1]-.3,c[0]+.3,1.1,c[1]+.3);box(sm,c[0]-.22,1.12,c[1]-.02,c[0]+.22,1.5,c[1]+.02);collide(c[0]-.35,c[1]-.35,c[0]+.35,c[1]+.35)}
  else{var hm=mat('hpil',{col:[.2,.95,1],emi:1,add:1,a:.28});box(hm,c[0]-.2,0,c[1]-.2,c[0]+.2,3.4,c[1]+.2);var bm=mat('hbase',{col:[.02,.1,.15],emi:.4});box(bm,c[0]-.4,0,c[1]-.4,c[0]+.4,.12,c[1]+.4);collide(c[0]-.4,c[1]-.4,c[0]+.4,c[1]+.4)}})
}
/* ---- grand hall ---- */
function buildHall(){
 var wm=mat('hallwall',{tex:T.plaster,emi:.3}),fm=mat('hallfloor',{tex:T.marble,a:.78,floor:1,emi:.1}),cm=mat('hallceil',{tex:T.ceil,col:[1.1,1.1,1.1],emi:.2});
 quad(fm,[-HW,0,HW],[HW,0,HW],[HW,0,-HW],[-HW,0,-HW],5,5);quad(cm,[-HW,HH,-HW],[HW,HH,-HW],[HW,HH,HW],[-HW,HH,HW],5,5);
 var th=.4;
 function wallZ(z,s){/* wall along x with door at center */box(wm,-HW,0,z-th/2,-DOOR,HH,z+th/2,3,2);box(wm,DOOR,0,z-th/2,HW,HH,z+th/2,3,2);box(wm,-DOOR,DH,z-th/2,DOOR,HH,z+th/2,1,1);collide(-HW,z-th/2,-DOOR,z+th/2);collide(DOOR,z-th/2,HW,z+th/2)}
 function wallX(x){box(wm,x-th/2,0,-HW,x+th/2,HH,-DOOR,3,2);box(wm,x-th/2,0,DOOR,x+th/2,HH,HW,3,2);box(wm,x-th/2,DH,-DOOR,x+th/2,HH,DOOR,1,1);collide(x-th/2,-HW,x+th/2,-DOOR);collide(x-th/2,DOOR,x+th/2,HW)}
 wallZ(-HW);wallZ(HW);wallX(-HW);wallX(HW);
 /* floating title */
 var tm=mat('hallTitle',{tex:textTex([{t:'ARCHIVE',s:170,c:'#fff',f:'Georgia,serif',ls:34,w:'500'},{t:'A DIGITAL MUSEUM OF PHILIPPINE POP CULTURE  ·  THEN & NOW',s:30,c:'#e8c9b8',f:'monospace',ls:5,w:'400'}],1400,380,{}),emi:1,a:1,add:0});
 var ti=mat('hallTitle2',{tex:textTex([{t:'ARCHIVE',s:170,c:'#fff',f:'Georgia,serif',ls:34,w:'500'},{t:'A DIGITAL MUSEUM OF PHILIPPINE POP CULTURE  ·  THEN & NOW',s:30,c:'#e8c9b8',f:'monospace',ls:5,w:'400'}],1400,380,{}),emi:1});
 quad(ti,[-6,5.2,-1.8],[6,5.2,-1.8],[6,8.2,-1.8],[-6,8.2,-1.8]);quad(ti,[6,5.2,-1.9],[-6,5.2,-1.9],[-6,8.2,-1.9],[6,8.2,-1.9]);
 /* door signs */
 function dsign(txt,sub,col,x,z,nx,nz){var m=mat('ds'+txt,{tex:textTex([{t:txt,s:84,c:col,f:'Georgia,serif'},{t:sub,s:34,c:'#ddd',f:'monospace',ls:3,w:'400'}],900,260,{bg:'rgba(10,10,14,.82)',border:col}),emi:1});var R=cross([0,1,0],[nx,0,nz]);quad(m,[x-R[0]*3,DH+.3,z-R[2]*3],[x+R[0]*3,DH+.3,z+R[2]*3],[x+R[0]*3,DH+1.2+.7,z+R[2]*3],[x-R[0]*3,DH+1.2+.7,z-R[2]*3])}
 dsign('THE PAST','2000–2010  ·  West wing','#e6c773',-HW+.25,0,1,0);dsign('THE PRESENT','2020–2026  ·  East wing','#ff4fa3',HW-.25,0,-1,0);dsign('THE FUTURE','Around 2030  ·  North wing','#38f9ff',0,-HW+.25,0,1);dsign('GAME ROOM','Then or Now?  ·  South','#ffb02e',0,HW-.25,0,-1);
 /* timeline strip on south wall */
 var tl=mat('tline',{tex:(function(){var c=mkCanvas(2048,200),x=c.getContext('2d');x.fillStyle='rgba(12,12,16,.9)';x.fillRect(0,0,2048,200);x.fillStyle='#777';x.fillRect(60,108,1928,4);var ys=[['2000',60,'#e6c773'],['2010',700,'#e6c773'],['2020',1100,'#ff4fa3'],['2026',1500,'#ff4fa3'],['2030',1960,'#38f9ff']];x.textAlign='center';ys.forEach(function(y){x.fillStyle=y[2];x.beginPath();x.arc(y[1],110,14,0,6.3);x.fill();x.font='700 54px monospace';x.fillText(y[0],y[1],70)});x.fillStyle='#aaa';x.font='28px monospace';x.fillText('PAST',380,160);x.fillText('PORTAL',900,160);x.fillText('PRESENT',1300,160);x.fillText('TIME MACHINE',1730,160);x.strokeStyle='#e6c773';x.strokeRect(2,2,2044,196);return tex(c,false)})(),emi:1});
 quad(tl,[-3.6,1.2,HW-.22],[-11,1.2,HW-.22],[-11,2.2,HW-.22],[-3.6,2.2,HW-.22]);quad(tl,[11,1.2,HW-.22],[3.6,1.2,HW-.22],[3.6,2.2,HW-.22],[11,2.2,HW-.22]);
 /* reference desk (center) */
 var dm=mat('desk',{tex:T.marble,col:[.7,.7,.75],emi:.25}),gm=mat('deskg',{col:[1,.8,.5],emi:1});
 var n=20;for(var i=0;i<n;i++){var a0=i/n*6.283,a1=(i+1)/n*6.283,r=2.2;quad(dm,[Math.cos(a0)*r,0,Math.sin(a0)*r],[Math.cos(a1)*r,0,Math.sin(a1)*r],[Math.cos(a1)*r,1.05,Math.sin(a1)*r],[Math.cos(a0)*r,1.05,Math.sin(a0)*r]);quad(gm,[Math.cos(a0)*r,1.05,Math.sin(a0)*r],[Math.cos(a1)*r,1.05,Math.sin(a1)*r],[Math.cos(a1)*(r-.12),1.05,Math.sin(a1)*(r-.12)],[Math.cos(a0)*(r-.12),1.05,Math.sin(a0)*(r-.12)])}
 collide(-2.2,-2.2,2.2,2.2);
 var ds=mat('desklbl',{tex:textTex([{t:'REFERENCE DESK',s:76,c:'#fff'},{t:'Press E for sources & credits',s:34,c:'#e6c773',f:'monospace',w:'400'}],900,230,{bg:'rgba(20,16,12,.85)',border:'#e6c773'}),emi:1});
 [[0,2.35,1],[0,-2.35,-1]].forEach(function(s){var z=s[1],nz=s[2];quad(ds,[nz*1.4*-1+0,1.25,z],[1.4*nz,1.25,z],[1.4*nz,1.8,z],[-1.4*nz,1.8,z])});
 var hl=mat('deskHolo',{col:[1,.8,.4],emi:1,add:1,a:.3});hl.R=function(t){return mul(trans(0,2.0,0),mul(rotY(t*.7),rotZ(Math.sin(t)*.2)))};octa(hl,.6);
 PICK.push({hub:'sources',c:[0,1.1,0],r:3.2,kind:'hub',label:'Reference desk: sources & credits'});
 LIGHTS.push({p:[0,7,0],c:LC.hall,r:26},{p:[-9,7,-9],c:LC.hall,r:20},{p:[9,7,-9],c:LC.hall,r:20},{p:[-9,7,9],c:LC.hall,r:20},{p:[9,7,9],c:LC.hall,r:20});
 ZONES.push({era:'hall',room:-1,x0:-HW,x1:HW,z0:-HW,z1:HW});
 /* ceiling lamp panels */
 var lm=mat('halllamp',{col:[1,.95,.85],emi:1});[-9,0,9].forEach(function(x){[-9,0,9].forEach(function(z){box(lm,x-1.4,HH-.05,z-.25,x+1.4,HH,z+.25)})});
}
/* ---- game room (south) ---- */
function buildGame(){
 var z0=HW,vz=8,gz0=z0+vz,gz1=gz0+22,gx=11;
 var wm=mat('gamewall',{tex:T.dark,col:[.5,.3,.9],emi:.55}),fm=mat('gamefloor',{tex:T.gfloor,col:[1,.4,.9],a:.7,floor:1,emi:.4}),cm=mat('gameceil',{col:[.03,.02,.07],emi:.3});
 quad(fm,[-gx,0,gz1],[gx,0,gz1],[gx,0,z0],[-gx,0,z0],10,10);quad(cm,[-gx,5.2,z0],[gx,5.2,z0],[gx,5.2,gz1],[-gx,5.2,gz1]);
 var th=.4;box(wm,-gx-th,0,gz0,-gx,5.2,gz1,6,1);box(wm,gx,0,gz0,gx+th,5.2,gz1,6,1);box(wm,-gx,0,gz1,gx,5.2,gz1+th,6,1);collide(-gx-th,gz0,-gx,gz1);collide(gx,gz0,gx+th,gz1);collide(-gx,gz1,gx+th,gz1+th);
 box(wm,-gx-th,0,z0,-DOOR,5.2,gz0,2,1);box(wm,DOOR,0,z0,gx+th,5.2,gz0,2,1);collide(-gx-th,z0,-DOOR,gz0);collide(DOOR,z0,gx+th,gz0);
 box(wm,-DOOR-th,0,z0,-DOOR,5.2,gz0,2,1);box(wm,DOOR,0,z0,DOOR+th,5.2,gz0,2,1);collide(-DOOR-th,z0,-DOOR,gz0);collide(DOOR,z0,DOOR+th,gz0);
 var vf=mat('gamevf',{tex:T.gfloor,col:[1,.4,.9],a:.7,floor:1,emi:.4});quad(vf,[-DOOR,0,gz0],[DOOR,0,gz0],[DOOR,0,z0],[-DOOR,0,z0],2,3);
 /* big screen */
 var sc=mat('gamescr',{tex:textTex([{t:'THE ARCADE',s:150,c:'#fff',f:'Sora,Arial Black,sans-serif'},{t:'Quiz · Picture pairs · Timeline challenge',s:42,c:'#ffb02e',f:'monospace',w:'400'},{t:'Choose a cabinet and press E to play',s:34,c:'#8ff',f:'monospace',w:'400'}],1400,520,{bg:'rgba(15,5,40,.95)',border:'#ff4fa3'}),emi:1});
 quad(sc,[7,1.5,gz1-.05],[-7,1.5,gz1-.05],[-7,5,gz1-.05],[7,5,gz1-.05]);
 /* cabinets */
 var cb=mat('cab',{col:[.12,.05,.25],emi:.4}),cs=mat('cabs',{col:[1,.5,.95],emi:1}),cm2=mat('cabm',{col:[.3,.9,1],emi:1});
 [[-6,gz0+5],[6,gz0+5],[-8,gz0+11],[8,gz0+11]].forEach(function(p,i){box(cb,p[0]-.6,0,p[1]-.5,p[0]+.6,2.1,p[1]+.5);box(cs,p[0]-.45,1.25,p[1]+(p[0]<0?.5:.5)-.01,p[0]+.45,1.9,p[1]+.52);box(cm2,p[0]-.5,.95,p[1]+.3,p[0]+.5,1.0,p[1]+.55);collide(p[0]-.65,p[1]-.55,p[0]+.65,p[1]+.55);var game=['memory','timeline','quiz','memory'][i],title=['PICTURE PAIRS','TIMELINE','THEN OR NOW?','PICTURE PAIRS'][i];var label=mat('arcade-label'+i,{tex:textTex([{t:title,s:64,c:'#fff'},{t:'Click or press E',s:32,c:'#8ff',f:'monospace'}],700,300,{bg:'#160d2b',border:'#8ff'}),emi:1});quad(label,[p[0]-.45,1.25,p[1]+.53],[p[0]+.45,1.25,p[1]+.53],[p[0]+.45,1.9,p[1]+.53],[p[0]-.45,1.9,p[1]+.53]);PICK.push({hub:'arcade',game:game,c:[p[0],1.5,p[1]],r:1.1,kind:'hub',label:'Play '+title})});
 /* console */
 var cc=[0,gz0+11];var pm=mat('gameped',{col:[.1,.05,.2],emi:.4});box(pm,cc[0]-1,0,cc[1]-.7,cc[0]+1,1.1,cc[1]+.7);collide(cc[0]-1.05,cc[1]-.75,cc[0]+1.05,cc[1]+.75);
 var pl=mat('gamelbl',{tex:textTex([{t:'PLAY',s:90,c:'#fff'},{t:'Press E · Then or Now?',s:36,c:'#ffb02e',f:'monospace',w:'400'}],700,230,{bg:'rgba(30,10,60,.95)',border:'#ff4fa3'}),emi:1});quad(pl,[cc[0]-1,1.12,cc[1]+.69],[cc[0]+1,1.12,cc[1]+.69],[cc[0]+1,1.12,cc[1]-.69],[cc[0]-1,1.12,cc[1]-.69]);
 var ring=mat('gamering',{col:[1,.3,.9],emi:1});ring.R=function(t){return mul(trans(cc[0],2.2,cc[1]),mul(rotX(1.5708),rotZ(t)))};torus(ring,.6,.04,40,6);
 PICK.push({hub:'quiz',c:[cc[0],1.1,cc[1]],r:2.5,kind:'hub',label:'Play: Then or Now?'});
 [[-8,gz0+3],[8,gz0+3],[0,gz0+14],[-8,gz0+17],[8,gz0+17]].forEach(function(p){LIGHTS.push({p:[p[0],4,p[1]],c:LC.game,r:16})});
 LIGHTS.push({p:[0,4,z0+4],c:LC.game,r:14});
 ZONES.push({era:'game',room:-1,x0:-gx,x1:gx,z0:z0,z1:gz1+1});
 STN.push({era:'game',idx:0,room:{name:'Game room',num:'★',yrs:'Then or Now?'},pos:[0,z0+3],yaw:Math.PI});
}
/* ---------------- build world ---------------- */
buildHall();
addWing('past',[-HW,0],[-1,0],[0,-1],6);addWing('present',[HW,0],[1,0],[0,1],6);addWing('future',[0,-HW],[0,-1],[1,0],6);
buildGame();
build();
/* ---------------- picture loading ---------------- */
var ITEMS=[],active=0,loadedN=0;
function itemPos(it){if(it.displayCenter)return it.displayCenter.slice();var m=it.mat;if(m.R){var model=m.R(0);return[model[12],model[14]]}return[(m.bb[0]+m.bb[3])/2,(m.bb[2]+m.bb[5])/2]}
function loadItem(it){it.st=1;var urls=[it.src];var i=0;function done(){active--}function next(){if(i>=urls.length){it.st=3;console.warn('Exhibit image unavailable: '+it.id);done();return}var im=new Image();im.crossOrigin='anonymous';var u=urls[i++];im.onload=function(){if(im.naturalWidth<40){next();return}if(it.st!==1){done();return}var c=mkCanvas(800,600),x=c.getContext('2d');x.imageSmoothingQuality='high';x.fillStyle='#151513';x.fillRect(0,0,800,600);var scale=Math.min(800/im.naturalWidth,600/im.naturalHeight),iw=im.naturalWidth*scale,ih=im.naturalHeight*scale;x.drawImage(im,(800-iw)/2,(600-ih)/2,iw,ih);if(it.mat.tex)gl.deleteTexture(it.mat.tex);it.mat.tex=tex(c,false);it.mat.col=[1,1,1];it.url=u;it.isArt=(u===it.art);it.st=2;done()};im.onerror=next;im.src=u}next()}
Object.keys(D.eras).forEach(function(e){D.eras[e].rooms.forEach(function(r){r.items.forEach(function(it){if(it.mat){it.p=itemPos(it);it.st=0;ITEMS.push(it)}})})});
function streamTex(){var near=[];ITEMS.forEach(function(it){var d=Math.hypot(it.p[0]-pl.x,it.p[1]-pl.z);it.d=d;if(d<34&&it.st===0)near.push(it);});near.sort(function(a,b){return a.d-b.d});for(var i=0;i<near.length&&active<4;i++){active++;loadItem(near[i])}}
/* ---------------- player ---------------- */
var pl={x:0,z:10,yaw:0,pitch:0,vy:0,bob:0,y:1.65},keys={},drag=null,joy=null,look=null,started=false,zone='hall',cur={era:'hall',room:-1},lerpA={amb:[.46,.45,.44],fog:[.07,.07,.09],fd:.016,bg:[.05,.05,.07]};
function tp(x,z,yaw){pl.x=x;pl.z=z;pl.yaw=yaw||0;pl.pitch=0}
function inZone(x,z){for(var i=0;i<ZONES.length;i++){var q=ZONES[i];if(x>=q.x0&&x<=q.x1&&z>=q.z0&&z<=q.z1&&(q.room>=0||true)){if(q.era==='hall'){var inw=false;for(var j=0;j<ZONES.length;j++){var w=ZONES[j];if(w.era!=='hall'&&w.era!=='game'&&x>=w.x0&&x<=w.x1&&z>=w.z0&&z<=w.z1)inw=true}if(!inw)return q}else return q}}
 if(x<-HW&&Math.abs(z)<=WW)return{era:'past',room:-1};if(x>HW&&Math.abs(z)<=WW)return{era:'present',room:-1};if(z<-HW&&Math.abs(x)<=WW)return{era:'future',room:-1};if(z>HW&&Math.abs(x)<=11)return{era:'game',room:-1};return{era:'hall',room:-1}}
function move(dt){
 var f=0,s=0,run=keys.ShiftLeft||keys.ShiftRight?1.9:1;
 if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD)s+=1;if(keys.KeyA)s-=1;
 if(keys.ArrowLeft)pl.yaw+=1.9*dt;if(keys.ArrowRight)pl.yaw-=1.9*dt;
 if(joy){f+=-joy.dy;s+=joy.dx}
 var l=Math.hypot(f,s);if(l>1){f/=l;s/=l}
 var sp=4.6*run*dt,sy=Math.sin(pl.yaw),cy=Math.cos(pl.yaw);
 var dx=(-sy*f+cy*s)*sp,dz=(-cy*f-sy*s)*sp;
 pl.x+=dx;resolve();pl.z+=dz;resolve();
 pl.bob+=l*dt*8;
}
function resolve(){var r=.38;for(var i=0;i<COL.length;i++){var c=COL[i];var nx=Math.max(c[0],Math.min(pl.x,c[2])),nz=Math.max(c[1],Math.min(pl.z,c[3]));var dx=pl.x-nx,dz=pl.z-nz,d=Math.hypot(dx,dz);if(d<r){if(d>1e-4){pl.x=nx+dx/d*r;pl.z=nz+dz/d*r}else{pl.x=c[0]-r}}}}
/* ---------------- input ---------------- */
addEventListener('keydown',function(e){if(modalOpen()||anyPanel()||/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName))return;keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>-1)e.preventDefault();if(e.code==='KeyE')interact(false);if(e.code==='KeyR'){tp(0,10,0)}if(e.code==='KeyM')openP('#mapPanel')});
addEventListener('keyup',function(e){keys[e.code]=false});
addEventListener('blur',function(){keys={}});
var downPt=null;
cv.addEventListener('pointerdown',function(e){cv.setPointerCapture(e.pointerId);downPt={x:e.clientX,y:e.clientY,t:Date.now()};if(e.pointerType==='touch'&&e.clientX<innerWidth*.4&&e.clientY>innerHeight*.45){joy={id:e.pointerId,ox:e.clientX,oy:e.clientY,dx:0,dy:0};showJoy(e.clientX,e.clientY)}else look={id:e.pointerId,x:e.clientX,y:e.clientY}});
cv.addEventListener('pointermove',function(e){mouse.x=e.clientX;mouse.y=e.clientY;if(joy&&e.pointerId===joy.id){var dx=(e.clientX-joy.ox)/50,dy=(e.clientY-joy.oy)/50,l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}joy.dx=dx;joy.dy=dy;moveJoy(dx,dy)}else if(look&&e.pointerId===look.id){pl.yaw-=(e.clientX-look.x)*.0045;pl.pitch=Math.max(-1.1,Math.min(1.1,pl.pitch-(e.clientY-look.y)*.0045));look.x=e.clientX;look.y=e.clientY}});
function up(e){if(joy&&e.pointerId===joy.id){joy=null;hideJoy();return}if(look&&e.pointerId===look.id){look=null;if(downPt&&Math.hypot(e.clientX-downPt.x,e.clientY-downPt.y)<6&&Date.now()-downPt.t<500){mouse.x=e.clientX;mouse.y=e.clientY;interact(true)}}}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
var mouse={x:innerWidth/2,y:innerHeight/2};
addEventListener('pointercancel',function(){joy=null;look=null;keys={};hideJoy()});
var jb=$('#joy'),jk=$('#joyk');function showJoy(x,y){jb.style.display='block';jb.style.left=x+'px';jb.style.top=y+'px';jk.style.transform='translate(0,0)'}function moveJoy(dx,dy){jk.style.transform='translate('+dx*34+'px,'+dy*34+'px)'}function hideJoy(){jb.style.display='none'}
/* ---------------- picking ---------------- */
function rayFrom(mx,my){var ndx=mx/cv.clientWidth*2-1,ndy=1-my/cv.clientHeight*2,t=Math.tan(FOV/2),asp=cv.clientWidth/cv.clientHeight;var d=[ndx*t*asp,ndy*t,-1];var cp=Math.cos(pl.pitch),sp=Math.sin(pl.pitch);var y1=d[1]*cp-d[2]*sp,z1=d[1]*sp+d[2]*cp;d=[d[0],y1,z1];var cyw=Math.cos(pl.yaw),syw=Math.sin(pl.yaw);var x2=d[0]*cyw+d[2]*syw,z2=-d[0]*syw+d[2]*cyw;var l=Math.hypot(x2,d[1],z2);return[x2/l,d[1]/l,z2/l]}
function pick(mx,my){var o=[pl.x,pl.y,pl.z],d=rayFrom(mx,my),best=null,bt=9;
 PICK.forEach(function(p){var t=null;
  if(p.kind==='art'){var den=d[0]*p.N[0]+d[2]*p.N[2];if(den>-1e-4)return;var tt=((p.c[0]-o[0])*p.N[0]+(p.c[2]-o[2])*p.N[2])/den;if(tt<0.1||tt>bt)return;var hx=o[0]+d[0]*tt-p.c[0],hy=o[1]+d[1]*tt-p.c[1],hz=o[2]+d[2]*tt-p.c[2];var a=hx*p.R[0]+hz*p.R[2];if(Math.abs(a)<p.hw&&Math.abs(hy)<p.hh)t=tt}
  else{var rx=p.c[0]-o[0],ry=p.c[1]-o[1],rz=p.c[2]-o[2],b=rx*d[0]+ry*d[1]+rz*d[2];if(b<0)return;var dd=rx*rx+ry*ry+rz*rz-b*b;var rr=p.kind==='hub'?p.r:p.r;if(dd<rr*rr&&b<(p.kind==='hub'?4.5:7)&&b<bt)t=b}
  if(t!==null&&t<bt){bt=t;best=p}});
 return best&&bt<(best.kind==='art'?7.5:7)?best:null}
var hover=null;
function interact(click){var p=click?pick(mouse.x,mouse.y):(pick(cv.clientWidth/2,cv.clientHeight/2)||nearHub());if(!p)return;if(p.hub==='sources')openP('#srcPanel');else if(p.hub==='quiz')openP('#quizPanel');else if(p.hub==='arcade'){openP('#quizPanel');if(window.ArchiveGames)window.ArchiveGames.select(p.game)}else if(p.hub==='mystery'){openP('#mysteryPanel');window.dispatchEvent(new CustomEvent('archive-mystery',{detail:p.clue}))}else if(p.item)openItem(p.item)}
function nearHub(){for(var i=0;i<PICK.length;i++){var p=PICK[i];if(p.kind==='hub'&&Math.hypot(p.c[0]-pl.x,p.c[2]-pl.z)<p.r+.9)return p}return null}
/* ---------------- modal / panels ---------------- */
var ALL=[];Object.keys(D.eras).forEach(function(e){D.eras[e].rooms.forEach(function(r){r.items.forEach(function(it){ALL.push(it)})})});
var modal=$('#modal'),mi=-1,html=document.documentElement;
function modalOpen(){return!modal.hidden}function anyPanel(){return $$('.panel').some(function(p){return!p.hidden})}
function openItem(it){var i=ALL.indexOf(it);if(i<0)return;mi=i;var image=new Image();image.alt=it.title;image.src=it.url||it.src;$('#mImg').replaceChildren(image);$('#mTxt').innerHTML=it.tpl;$('#mTxt').scrollTop=0;$('#mPos').textContent=(i+1)+' / '+ALL.length;modal.hidden=false;html.classList.add('lock');keys={};var close=modal.querySelector('[data-act="closep"]');if(close)close.focus()}
function closeP(){$$('.panel').forEach(function(p){p.hidden=true});modal.hidden=true;html.classList.remove('lock');keys={}}
function openP(id){closeP();$(id).hidden=false;html.classList.add('lock');keys={}}
function gotoStn(era,idx){for(var i=0;i<STN.length;i++)if(STN[i].era===era&&STN[i].idx===idx){tp(STN[i].pos[0],STN[i].pos[1],STN[i].yaw);return true}return false}
function gotoId(id){var m=/^(past|present|future)-(\w+)-gate$/.exec(id);if(m){var rooms=D.eras[m[1]].rooms;for(var i=0;i<rooms.length;i++)if(rooms[i].cid===m[2])return gotoStn(m[1],i)}
 if(id==='game-gate'||id==='game'){tp(0,HW+11,Math.PI);return true}
 if(/^hall-(past|present|future)$/.test(id)){var e=id.split('-')[1];var s=e==='past'?[-HW-2,0,Math.PI/2]:e==='present'?[HW+2,0,-Math.PI/2]:[0,-HW-2,0];tp(s[0],s[1],s[2]);return true}
 if(id==='portal'){tp(HW+3,0,-Math.PI/2);return true}if(id==='tm'){tp(0,-HW-3,0);return true}if(id==='sources'){openP('#srcPanel');return true}
 for(var e2 in D.eras){var rs=D.eras[e2].rooms;for(var i2=0;i2<rs.length;i2++){var its=rs[i2].items;for(var k=0;k<its.length;k++)if(its[k].id===id||(its[k].aliases||[]).indexOf(id)>-1){gotoStn(e2,i2);setTimeout(function(it){return function(){openItem(it)}}(its[k]),700);return true}}}
 return false}
document.addEventListener('click',function(e){
 var act=e.target.closest('[data-act]');
 if(act){var a=act.dataset.act;
  if(a==='enter')enter();else if(a==='map')openP('#mapPanel');else if(a==='help')openP('#helpPanel');else if(a==='quiz')openP('#quizPanel');else if(a==='sources')openP('#srcPanel');
  else if(a==='closep')closeP();else if(a==='mprev')openItem(ALL[Math.max(0,mi-1)]);else if(a==='mnext')openItem(ALL[Math.min(ALL.length-1,mi+1)]);
  else if(a==='motion'){motionEnabled=!motionEnabled;act.setAttribute('aria-pressed',String(motionEnabled));act.textContent=motionEnabled?'Motion: on':'Motion: off'}
  else if(a==='lobby'){closeP();tp(0,10,0)}
  return}
 var go=e.target.closest('[data-go]');if(go){closeP();gotoId(go.dataset.go);return}
 var sl=e.target.closest('#srcPanel a[href]');if(sl){var h=sl.getAttribute('href');var m=/^(past|present|future)\.html#(\w+)$/.exec(h);if(m){e.preventDefault();closeP();gotoId(m[1]+'-'+m[2]+'-gate')}}
 if(e.target.classList&&(e.target.classList.contains('panel')||e.target.classList.contains('modal')))closeP();
});
addEventListener('keydown',function(e){if(e.key==='Escape')closeP();if(modalOpen()){if(e.key==='ArrowRight')openItem(ALL[Math.min(ALL.length-1,mi+1)]);if(e.key==='ArrowLeft')openItem(ALL[Math.max(0,mi-1)])}});
/* splash */
var splash=$('#splash');function enter(){started=true;splash.classList.add('gone');setTimeout(function(){splash.style.display='none'},900);html.classList.remove('lock');tp(0,10,0);setTimeout(function(){$('#hHint').style.opacity=1},300);setTimeout(function(){$('#hHint').style.opacity=0},9000)}
if(typeof matchMedia==='function')motionEnabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;var motionButton=$('[data-act=motion]');if(motionButton){motionButton.setAttribute('aria-pressed',String(motionEnabled));motionButton.textContent=motionEnabled?'Motion: on':'Motion: off'}
enter();
function hash(){var h;try{h=decodeURIComponent(location.hash.slice(1))}catch(e){return;}if(!h)return;splash.classList.add('gone');splash.style.display='none';html.classList.remove('lock');started=true;closeP();gotoId(h)}
setTimeout(hash,200);addEventListener('hashchange',hash);
(function(){
 var select=$('#roomSelect'),previous=$('#previousRoom'),next=$('#nextRoom');
 STN.forEach(function(st,i){var option=document.createElement('option');option.value=String(i);option.textContent=st.era==='game'?'Game room':st.era[0].toUpperCase()+st.era.slice(1)+' · '+st.room.name;select.appendChild(option)});
 function go(i){closeP();if(i<0){tp(0,10,0);select.value='hall'}else{var st=STN[i];tp(st.pos[0],st.pos[1],st.yaw);select.value=String(i)}cv.focus()}
 select.addEventListener('change',function(){go(select.value==='hall'?-1:Number(select.value))});
 previous.addEventListener('click',function(){go(select.value==='hall'?STN.length-1:Number(select.value)-1)});
 next.addEventListener('click',function(){go(select.value==='hall'?0:(Number(select.value)+1)%STN.length)});
 var old=updHud;updHud=function(z){old(z);var i=STN.indexOf(z.stn);select.value=i<0?'hall':String(i)};
})();
/* ---------------- quiz ---------------- */
(function(){var box=$('#quiz'),raw=$('#quizdata');if(!box||!raw)return;var Q=JSON.parse(raw.textContent),order,i,score,streak;
 function shf(a){a=a.slice();for(var k=a.length-1;k>0;k--){var j=Math.floor(Math.random()*(k+1)),t=a[k];a[k]=a[j];a[j]=t}return a}
 function show(){var q=order[i];$('#qCount').textContent='Question '+(i+1)+' / '+order.length;$('#qBar').style.width=(i/order.length*100)+'%';$('#qText').textContent=q.s;$('#qRes').hidden=true;$$('.q-opt').forEach(function(b){b.disabled=false;b.className='q-opt'});$('#qStreak').textContent=streak>1?streak+' in a row':''}
 function start(){order=shf(Q);i=0;score=0;streak=0;$('#qIntro').hidden=true;$('#qEnd').hidden=true;$('#qPlay').hidden=false;show()}
 function ans(a){var q=order[i];$$('.q-opt').forEach(function(b){b.disabled=true;var v=b.getAttribute('data-a');if(v===q.a)b.classList.add('good');else if(v===a)b.classList.add('bad')});var ok=a===q.a;if(ok){score++;streak++}else streak=0;$('#qVerdict').textContent=ok?'Correct!':'Not quite.';$('#qWhy').textContent=q.w;$('#qRes').hidden=false;$('#qNext').textContent=i===order.length-1?'See my result':'Next →';$('#qStreak').textContent=streak>1?streak+' in a row':''}
 function end(){$('#qPlay').hidden=true;$('#qEnd').hidden=false;$('#qScore').textContent=score+' / '+order.length;$('#qTitle').textContent=score>=11?'Master Curator':score>=8?'Seasoned Archivist':score>=5?'Curious Visitor':'First-Time Visitor';$('#qMsg').textContent=score>=8?'You know your Philippine pop culture across the decades.':'Walk the Past and Present wings again, then try for a higher title.'}
 $('#qStart').addEventListener('click',start);$('#qAgain').addEventListener('click',start);$$('.q-opt').forEach(function(b){b.addEventListener('click',function(){ans(b.getAttribute('data-a'))})});$('#qNext').addEventListener('click',function(){i++;i>=order.length?end():show()})})();
/* ---------------- render ---------------- */
var FOV=1.2,W_=0,H_=0,time=0;
var RS=1,ema=.016;function resize(){var dpr=Math.min(devicePixelRatio||1,2)*RS;W_=cv.clientWidth;H_=cv.clientHeight;cv.width=Math.floor(W_*dpr);cv.height=Math.floor(H_*dpr);gl.viewport(0,0,cv.width,cv.height);FOV=W_<H_?1.45:1.15}
addEventListener('resize',resize);resize();
var dust=[];for(var i=0;i<110;i++)dust.push([(Math.random()-.5)*20,Math.random()*5,(Math.random()-.5)*20]);
var dbuf=gl.createBuffer(),dva=gl.createVertexArray();var dpos=new Float32Array(dust.length*3);
function lightsNear(){var arr=LIGHTS.map(function(l){var d=Math.hypot(l.p[0]-pl.x,l.p[2]-pl.z);return[d,l]}).sort(function(a,b){return a[0]-b[0]}).slice(0,8);var L=new Float32Array(32),C=new Float32Array(24);for(var i=0;i<8;i++){if(arr[i]){var l=arr[i][1];L[i*4]=l.p[0];L[i*4+1]=l.p[1];L[i*4+2]=l.p[2];L[i*4+3]=l.r;C[i*3]=l.c[0]*1.1;C[i*3+1]=l.c[1]*1.1;C[i*3+2]=l.c[2]*1.1}}return[L,C]}
function drawBatch(b){
 var model=b.R?b.R(time):I4;if(b.R&&Math.hypot(model[12]-pl.x,model[14]-pl.z)>52)return;
 if(!b.nocull&&b.rad<30){var d=Math.hypot(b.cx-pl.x,b.cz-pl.z)-b.rad;if(d>(b.far||48))return}
 gl.uniformMatrix4fv(U.uMod,false,model);
 if(b.tex){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,b.tex);gl.uniform1f(U.uUseTex,1)}else gl.uniform1f(U.uUseTex,0);
 gl.uniform4f(U.uCol,b.col[0],b.col[1],b.col[2],b.a);gl.uniform1f(U.uEmi,b.emi);gl.uniform1f(U.uScan,b.scan||0);
 if(b.add){gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false)}else if(b.a<1){gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}else{gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true)}
 gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.n)}
var last=0,hud={era:'',room:''},stT=0;function streamTex2(){stT-=1;if(stT<=0){stT=20;streamTex()}}
function lerpv(a,b,t){return a.map(function(x,i){return x+(b[i]-x)*t})}
function frame(ts){requestAnimationFrame(frame);try{frame0(ts)}catch(err){if(!frame.bad){frame.bad=1;console.error(err)}gl.depthMask(true)}}
function frame0(ts){var raw=(ts-last)/1000||.016,dt=Math.min(.05,raw);last=ts;if(motionEnabled&&!document.hidden&&!modalOpen()&&!anyPanel())time+=dt;ema+=(Math.min(raw,.5)-ema)*.06;if(ema>.04&&RS>.45&&started){RS=Math.max(.45,RS-.15);ema=.02;resize()}
 if(started&&!modalOpen()&&!anyPanel())move(dt);
 streamTex2();var z=inZone(pl.x,pl.z);if(z.era!==cur.era||z.room!==cur.room){cur=z;updHud(z)}
 var tg=ERAC[z.era]||ERAC.hall,k=Math.min(1,dt*1.8);lerpA.amb=lerpv(lerpA.amb,tg.amb,k);lerpA.fog=lerpv(lerpA.fog,tg.fog,k);lerpA.bg=lerpv(lerpA.bg,tg.bg,k);lerpA.fd+=(tg.fd-lerpA.fd)*k;
 var pr=persp(FOV,W_/H_,.08,160);var by=Math.sin(pl.bob)*.035;pl.y=1.65+by;
 var view=mul(rotX(-pl.pitch),mul(rotY(-pl.yaw),trans(-pl.x,-pl.y,-pl.z)));var vp=mul(pr,view);
 gl.clearColor(lerpA.bg[0],lerpA.bg[1],lerpA.bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.disable(gl.CULL_FACE);
 gl.useProgram(P);var ls=lightsNear();gl.uniform4fv(U.uL,ls[0]);gl.uniform3fv(U.uLC,ls[1]);gl.uniform3fv(U.uAmb,lerpA.amb);gl.uniform3fv(U.uFog,lerpA.fog);gl.uniform1f(U.uFogD,lerpA.fd);gl.uniform1f(U.uTime,time);gl.uniform1i(U.uTex,0);
 var opaque=[],floors=[],trans_=[],adds=[];batches.forEach(function(b){if(b.add)adds.push(b);else if(b.floor)floors.push(b);else if(b.a<1)trans_.push(b);else opaque.push(b)});
 gl.uniformMatrix4fv(U.uVP,false,vp);
 var useMirror=z.era!=='past';
 if(useMirror){gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniformMatrix4fv(U.uM,false,MIRROR);gl.uniform3f(U.uCam,pl.x,-pl.y,pl.z);opaque.forEach(function(b){drawBatch(b)});adds.forEach(function(b){drawBatch(b)});trans_.forEach(function(b){drawBatch(b)})}
 gl.uniformMatrix4fv(U.uM,false,I4);gl.uniform3f(U.uCam,pl.x,pl.y,pl.z);
 /* floors first when mirror on (blend over reflection), then solids */
 floors.forEach(function(b){var a0=b.a;if(!useMirror)b.a=1;drawBatch(b);b.a=a0});
 opaque.forEach(function(b){drawBatch(b)});trans_.forEach(function(b){drawBatch(b)});adds.forEach(function(b){drawBatch(b)});
 gl.depthMask(true);
 /* dust */
 var dc=z.era==='past'?[1,.85,.55,.5]:z.era==='future'?[.3,.95,1,.7]:z.era==='game'?[1,.4,.9,.6]:null;
 if(dc){for(var i=0;i<dust.length;i++){var d=dust[i];d[1]+=(z.era==='past'?-.03:.05)*dt*(1+i%3);d[0]+=Math.sin(time*.3+i)*.002;if(d[1]<0)d[1]=5;if(d[1]>5)d[1]=0;dpos[i*3]=pl.x+((d[0]+pl.x*0)%10);dpos[i*3+1]=d[1];dpos[i*3+2]=pl.z+d[2]%10}
  gl.useProgram(PD);gl.uniformMatrix4fv(UD.uVP,false,vp);gl.uniform1f(UD.uSz,34*(cv.height/900));gl.uniform4fv(UD.uC,dc);gl.bindVertexArray(dva);gl.bindBuffer(gl.ARRAY_BUFFER,dbuf);gl.bufferData(gl.ARRAY_BUFFER,dpos,gl.DYNAMIC_DRAW);var loc=gl.getAttribLocation(PD,'aP');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.depthMask(false);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.drawArrays(gl.POINTS,0,dust.length);gl.depthMask(true)}
 /* prompt */
 var pk=(!modalOpen()&&!anyPanel())?(pick(mouse.x,mouse.y)||nearHub()):null;var pe=$('#prompt');if(pk&&started){pe.hidden=false;pe.innerHTML='<b>'+(pk.hub?pk.label:pk.item.title)+'</b><span>Click or press E to '+(pk.hub?'open':'inspect')+'</span>';cv.style.cursor='pointer'}else{pe.hidden=true;cv.style.cursor=look?'grabbing':'grab'}
 mini()}
var NAMES={hall:'Grand Master Hall',past:'The Past Wing · 2000–2010',present:'The Present Wing · 2020–2026',future:'The Future Wing · around 2030',game:'The Arcade · Three games'};
function updHud(z){document.body.dataset.era=z.era;$('#eChip').textContent=NAMES[z.era]||'';var s=z.stn&&z.stn.room?'Room '+z.stn.room.num+' · '+z.stn.room.name:z.era==='hall'?'Choose a wing: West, East, North or South':z.era==='game'?'Choose a cabinet: Quiz, Picture pairs or Timeline':'Wing entrance';$('#hRoom').textContent=s}
/* ---------------- minimap ---------------- */
var mc=$('#mini'),mx=mc.getContext('2d');
function mini(){var w=mc.width,h=mc.height,sx=w/250,ox=w/2,oz=h*.5+10;mx.clearRect(0,0,w,h);mx.fillStyle='rgba(8,8,12,.7)';mx.fillRect(0,0,w,h);function R(x0,z0,x1,z1,c){mx.fillStyle=c;mx.fillRect(ox+x0*sx,oz+z0*sx,(x1-x0)*sx,(z1-z0)*sx)}
 R(-HW,-HW,HW,HW,'#6b6b78');R(-HW-96,-WW,-HW,WW,'#8a6a3c');R(HW,-WW,HW+96,WW,'#e9d9ff');R(-WW,-HW-96,WW,-HW,'#1b6d86');R(-11,HW+8,11,HW+30,'#7a2a8c');
 ZONES.forEach(function(q){if(q.stn)R(q.x0,q.z0,q.x0+.4,q.z1,'rgba(0,0,0,.5)')});
 mx.fillStyle='#fff';mx.font='10px monospace';mx.textAlign='center';mx.fillText('PAST',ox-60*sx*.5-HW*sx*.0-45,oz+3);mx.fillText('PRESENT',ox+55,oz+3);mx.fillText('FUTURE',ox,oz-70);mx.fillText('HALL',ox,oz+3);mx.fillText('GAME',ox,oz+HW*sx+24);
 var px=ox+pl.x*sx,pz=oz+pl.z*sx;mx.fillStyle='#ff4fa3';mx.beginPath();mx.arc(px,pz,4,0,6.3);mx.fill();mx.strokeStyle='#fff';mx.beginPath();mx.moveTo(px,pz);mx.lineTo(px-Math.sin(pl.yaw)*12,pz-Math.cos(pl.yaw)*12);mx.stroke()}
mc.addEventListener('click',function(e){var r=mc.getBoundingClientRect(),w=mc.width,sx=w/250,x=((e.clientX-r.left)/r.width*w-w/2)/sx,z=((e.clientY-r.top)/r.height*mc.height-(mc.height*.5+10))/sx;if(Math.abs(x)<HW&&Math.abs(z)<HW)tp(x,z,pl.yaw)});
requestAnimationFrame(frame);
window.__museum={col:COL,pl:pl,tp:tp,gotoId:gotoId,enter:enter,zone:function(){return cur}};
})();
