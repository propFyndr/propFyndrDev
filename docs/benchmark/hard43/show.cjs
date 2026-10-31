const o=require('../answers/hard43-before.json').turns, c=require('./chatgpt.json'), p=require('./perplexity.json');
const [from,to,on,cn]=[+process.argv[2],+process.argv[3],+process.argv[4]||800,+process.argv[5]||450];
const flat=s=>(s||'').replace(/\n{2,}/g,'\n').replace(/\s*\n\s*/g,' | ');
o.slice(from,to).forEach(t=>{console.log('\n##',t.id,'-',t.q);console.log('OURS['+t.lane+']:',flat(t.answer).slice(0,on));console.log('GPT:',flat(c[t.id]?.text).slice(0,cn));if(p[t.id])console.log('PPLX:',flat(p[t.id].text).slice(0,cn));});
