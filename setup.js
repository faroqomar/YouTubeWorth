const token=document.querySelector('#pair-token').textContent;
document.querySelector('#copy-token').onclick=async()=>{try{await navigator.clipboard.writeText(token);document.querySelector('#copy-token').textContent='Copied';}catch{document.querySelector('#setup-status').textContent='Select and copy the code manually.';}};
async function ready(){try{const data=await(await fetch('/health')).json();document.querySelector('#setup-status').textContent=data.ready?`Laya ready locally · ${data.device==='mps'?'GPU':'CPU'}`:data.status==='failed'?'Laya failed to start. Run start.command or check the service log.':'Laya is warming up…';if(!data.ready)setTimeout(ready,2000);}catch{document.querySelector('#setup-status').textContent='Local service stopped. Run start.command.';}}
ready();
