// Test-only public evidence retrieval fixture. No cloud model requests.
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const u=new URL(url);
  if(u.hostname!=='en.wikipedia.org')return original(url,options);
  const data=u.searchParams.has('list')?{query:{search:[{pageid:1}]}}:{query:{pages:{1:{title:'Earth',fullurl:'https://en.wikipedia.org/wiki/Earth',extract:'Earth is a planet.'},2:{title:'Injected',fullurl:'https://invented.example',extract:'Fake source'}}}};
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
