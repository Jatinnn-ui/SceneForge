import {parse} from 'https://esm.sh/acorn@8.14.0';
const output=document.getElementById('results');output.textContent='';
const report=(ok,message)=>{output.textContent+=(ok?'PASS ':'FAIL ')+message+'\n';console[ok?'log':'error']((ok?'PASS ':'FAIL ')+message);};
for(const file of ['src/app.js','src/store.js','src/scene.js']){const source=await fetch('../'+file).then(r=>r.text());try{parse(source,{ecmaVersion:'latest',sourceType:'module'});report(true,'Syntax: '+file);}catch(e){report(false,file+' '+e.message+' '+source.slice(e.pos-80,e.pos+80));}}
try{
 const {demo,parseCommand,localScene,validateScene,useScene,WEATHER,TIMES}=await import('../src/store.js');
 const base=demo(),copy=JSON.stringify(base);
 let next=parseCommand('Add a tree near the house',base).scene;
 report(next.objects.length===base.objects.length+1,'Add object command');
 report(JSON.stringify(base)===copy,'Commands preserve original scene');
 const fire=base.objects.find(o=>o.type==='campfire');const nearest=base.objects.filter(o=>o.type==='rock').sort((a,b)=>Math.hypot(a.position[0]-fire.position[0],a.position[2]-fire.position[2])-Math.hypot(b.position[0]-fire.position[0],b.position[2]-fire.position[2]))[0];
 next=parseCommand('Remove the rock near the campfire',base).scene;report(!next.objects.some(o=>o.id===nearest.id)&&next.objects.length===base.objects.length-1,'Nearest-object removal');
 for(const weather of WEATHER){report(parseCommand('Make it '+weather,base).scene.environment.weather===weather,'Weather: '+weather);}
 for(const time of TIMES){report(parseCommand('Make it '+time,base).scene.environment.time===time,'Time: '+time);}
 next=parseCommand('Add three pine trees',base).scene;report(next.objects.length===base.objects.length+3,'Object counts');
 next=parseCommand('Move the tent near the house',base).scene;report(next.objects.find(o=>o.type==='tent').position[0]===base.objects.find(o=>o.type==='house').position[0]+2.5,'Move operation');
 for(const prompt of ['Peaceful campsite beside a river','Small medieval village','Mountain cabin with pine trees','Desert camp with a watchtower','Island with a lighthouse'])report(!!validateScene(localScene(prompt)),'Local template: '+prompt);
 for(const broken of [{}, {...base,environment:{weather:'lava',time:'sunset'}},{...base,objects:[{id:'bad',type:'dragon',position:[0,0,0],scale:1}]},{...base,objects:[{id:'bad',type:'rock',position:[NaN,0,0],scale:1}]}]){let rejected=false;try{validateScene(broken);}catch{rejected=true;}report(rejected,'Reject invalid scene');}
 let rejected=false;try{parseCommand('Build a spaceship with quantum engines',base);}catch{rejected=true;}report(rejected,'Unsupported commands show errors');
 useScene.getState().load(base);useScene.getState().select(base.objects[0].id);useScene.getState().remove(base.objects[0].id);report(useScene.getState().selected===null,'Deleting selected object clears inspector');
 useScene.getState().load(demo());useScene.getState().execute('Make it snowy');report(useScene.getState().history.length===1&&useScene.getState().scene.environment.weather==='snow','Zustand command/history integration');
}catch(e){report(false,e.stack);}
const iframe=document.createElement('iframe');iframe.src='../index.html';iframe.style='width:100%;height:800px;border:1px solid #ccc';document.body.append(iframe);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){if(fn())return fn();await wait(200);}throw Error('Timed out: '+label);}
try{
 const doc=await until(()=>iframe.contentDocument?.querySelector('.landing')&&iframe.contentDocument,'Landing load');
 const clickText=(text)=>{const el=[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!el)throw Error('Missing button '+text);el.click();};
 clickText('Try Demo');await until(()=>doc.querySelector('.editor'),'Demo editor');report(true,'Try Demo opens editor');
 doc.querySelector('[aria-label="Scene objects"]').click();await wait(250);doc.querySelector('.object-list button').click();await wait(250);report(!!doc.querySelector('.inspector'),'Object selection opens inspector');
 const countBefore=doc.querySelectorAll('.object-list button').length;doc.querySelector('.delete-button').click();await wait(250);report(doc.querySelectorAll('.object-list button').length===countBefore-1&&!doc.querySelector('.inspector'),'Inspector delete updates scene');
 clickText('Make it rainy');await wait(150);doc.querySelector('.command-form').dispatchEvent(new iframe.contentWindow.Event('submit',{bubbles:true,cancelable:true}));await wait(300);report(doc.querySelector('[aria-label="Weather"]').value==='rain','Command form changes weather');
 doc.querySelector('[aria-label="Reset scene"]').click();await wait(150);clickText('Reset scene');await wait(300);report(doc.querySelector('[aria-label="Weather"]').value==='clear','Reset restores environment');
 doc.querySelector('[aria-label="Create a new scene"]').click();await wait(150);clickText('Small medieval village');await wait(150);const ai=[...doc.querySelectorAll('.engine-tabs button')][1];ai.click();await wait(150);doc.querySelector('.modal form').dispatchEvent(new iframe.contentWindow.Event('submit',{bubbles:true,cancelable:true}));await wait(150);report(doc.querySelector('.error-message')?.textContent.includes('Gemini is not connected'),'Gemini unavailable error is honest');
 doc.querySelector('.engine-tabs button').click();await wait(100);doc.querySelector('.modal form').dispatchEvent(new iframe.contentWindow.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!doc.querySelector('.modal'),'Generation complete');report(doc.querySelector('.scene-name')?.textContent==='Small medieval village','Local generation opens new scene');
 await until(()=>doc.querySelector('canvas'),'3D canvas');report(![...doc.querySelectorAll('.canvas-error')].some(el=>!el.closest('canvas')),'3D canvas mounted without renderer error');
}catch(e){report(false,e.stack);}
output.dataset.complete='true';
