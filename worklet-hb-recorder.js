
class HBRecorder extends AudioWorkletProcessor{
  constructor(){super();this.on=false;this.L=new Float32Array(8192);this.R=new Float32Array(8192);this.n=0;this.lvl=0;this.k=0;
    this.port.onmessage=e=>{const d=e.data;if(d==='start'){this.on=true;this.sent=false;this.n=0;}else if(d==='stop'){this.on=false;this.flush();this.port.postMessage({t:'end'});}};}
  flush(){if(!this.n)return;const l=this.L.slice(0,this.n),r=this.R.slice(0,this.n);this.port.postMessage({t:'data',l,r},[l.buffer,r.buffer]);this.n=0;}
  process(inp){const i=inp[0];if(!i||!i.length)return true;const a=i[0],b=i[1]||i[0],m=a.length;
    let pk=0;for(let s=0;s<m;s++){const x=Math.abs(a[s]);if(x>pk)pk=x;}this.lvl=Math.max(pk,this.lvl*0.9);
    if(++this.k>=8){this.k=0;this.port.postMessage({t:'lvl',v:this.lvl});}
    if(this.on){if(!this.sent){this.sent=true;this.port.postMessage({t:'t0',time:currentTime});}
      for(let s=0;s<m;s++){this.L[this.n]=a[s];this.R[this.n]=b[s];this.n++;if(this.n>=this.L.length)this.flush();}}
    return true;}}
registerProcessor('hb-recorder',HBRecorder);