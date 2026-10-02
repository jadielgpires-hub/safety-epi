/* Safety EPI - gerador QR local (sem CDN)
 * Implementação própria para QR Code Version 6, nível L, modo Byte.
 * Capacidade: até 134 bytes UTF-8, suficiente para os links internos do Safety EPI.
 */
(function(global){
  "use strict";

  const VERSION = 6;
  const SIZE = 21 + 4 * (VERSION - 1); // 41
  const DATA_CODEWORDS = 136;
  const BLOCK_DATA = 68;
  const ECC_PER_BLOCK = 18;
  const TOTAL_CODEWORDS = 172;
  const MAX_BYTES = 134;

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF(){
    let x = 1;
    for(let i=0;i<255;i++){
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if(x & 0x100) x ^= 0x11d;
    }
    for(let i=255;i<512;i++) EXP[i] = EXP[i-255];
  })();

  function gfMul(a,b){
    if(a===0 || b===0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function polyMul(a,b){
    const out = new Array(a.length + b.length - 1).fill(0);
    for(let i=0;i<a.length;i++){
      for(let j=0;j<b.length;j++) out[i+j] ^= gfMul(a[i],b[j]);
    }
    return out;
  }

  function rsGenerator(degree){
    let g = [1];
    for(let i=0;i<degree;i++) g = polyMul(g,[1,EXP[i]]);
    return g;
  }
  const RS_GEN = rsGenerator(ECC_PER_BLOCK);

  function rsRemainder(data){
    const rem = new Array(ECC_PER_BLOCK).fill(0);
    for(const byte of data){
      const factor = byte ^ rem[0];
      for(let i=0;i<ECC_PER_BLOCK-1;i++) rem[i] = rem[i+1];
      rem[ECC_PER_BLOCK-1] = 0;
      if(factor!==0){
        for(let i=0;i<ECC_PER_BLOCK;i++) rem[i] ^= gfMul(RS_GEN[i+1],factor);
      }
    }
    return rem;
  }

  function appendBits(arr,value,length){
    for(let i=length-1;i>=0;i--) arr.push((value >>> i) & 1);
  }

  function makeCodewords(text){
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    if(bytes.length > MAX_BYTES) throw new Error(`Link muito longo para o QR local (${bytes.length}/${MAX_BYTES} bytes).`);

    const bits = [];
    appendBits(bits,0b0100,4); // Byte mode
    appendBits(bits,bytes.length,8); // Version 1-9: 8 bits
    for(const b of bytes) appendBits(bits,b,8);

    const capacity = DATA_CODEWORDS * 8;
    const terminator = Math.min(4,capacity-bits.length);
    for(let i=0;i<terminator;i++) bits.push(0);
    while(bits.length % 8) bits.push(0);

    const data = [];
    for(let i=0;i<bits.length;i+=8){
      let v=0;
      for(let j=0;j<8;j++) v=(v<<1)|bits[i+j];
      data.push(v);
    }
    let pad = true;
    while(data.length < DATA_CODEWORDS){ data.push(pad?0xec:0x11); pad=!pad; }

    const blocks = [data.slice(0,BLOCK_DATA),data.slice(BLOCK_DATA,BLOCK_DATA*2)];
    const ecc = blocks.map(rsRemainder);
    const out = [];
    for(let i=0;i<BLOCK_DATA;i++) for(let b=0;b<2;b++) out.push(blocks[b][i]);
    for(let i=0;i<ECC_PER_BLOCK;i++) for(let b=0;b<2;b++) out.push(ecc[b][i]);
    if(out.length!==TOTAL_CODEWORDS) throw new Error("Falha interna ao montar QR Code.");
    return out;
  }

  function formatBits(mask){
    const eclBits = 1; // L = 01
    const data = (eclBits << 3) | mask;
    let rem = data << 10;
    for(let i=14;i>=10;i--) if((rem >>> i)&1) rem ^= 0x537 << (i-10);
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  }

  function makeMatrix(text){
    const codewords = makeCodewords(text);
    const m = Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    const fn = Array.from({length:SIZE},()=>Array(SIZE).fill(false));

    const setF=(x,y,dark)=>{
      if(x<0||y<0||x>=SIZE||y>=SIZE) return;
      m[y][x]=!!dark; fn[y][x]=true;
    };

    const finder=(x,y)=>{
      for(let dy=-1;dy<=7;dy++) for(let dx=-1;dx<=7;dx++){
        const xx=x+dx, yy=y+dy;
        if(xx<0||yy<0||xx>=SIZE||yy>=SIZE) continue;
        const inside=dx>=0&&dx<=6&&dy>=0&&dy<=6;
        const dark=inside && (dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4));
        setF(xx,yy,dark);
      }
    };
    finder(0,0); finder(SIZE-7,0); finder(0,SIZE-7);

    // Alignment pattern for Version 6: centers [6,34]; only (34,34) does not overlap a finder.
    const cx=34, cy=34;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      const d=Math.max(Math.abs(dx),Math.abs(dy));
      setF(cx+dx,cy+dy,d!==1);
    }

    // Timing patterns
    for(let i=8;i<SIZE-8;i++){
      if(!fn[6][i]) setF(i,6,i%2===0);
      if(!fn[i][6]) setF(6,i,i%2===0);
    }

    // Format information (mask 0)
    const mask=0, fmt=formatBits(mask);
    const bit=i=>((fmt>>>i)&1)!==0;
    for(let i=0;i<=5;i++) setF(8,i,bit(i));
    setF(8,7,bit(6));
    setF(8,8,bit(7));
    setF(7,8,bit(8));
    for(let i=9;i<=14;i++) setF(14-i,8,bit(i));
    for(let i=0;i<=7;i++) setF(SIZE-1-i,8,bit(i));
    for(let i=8;i<=14;i++) setF(8,SIZE-15+i,bit(i));
    setF(8,SIZE-8,true); // dark module

    const dataBits=[];
    for(const cw of codewords) appendBits(dataBits,cw,8);
    let idx=0;
    let upward=true;
    for(let right=SIZE-1;right>=1;right-=2){
      if(right===6) right--;
      for(let vert=0;vert<SIZE;vert++){
        const y=upward?SIZE-1-vert:vert;
        for(let j=0;j<2;j++){
          const x=right-j;
          if(fn[y][x]) continue;
          let dark=idx<dataBits.length ? dataBits[idx++]===1 : false;
          if((x+y)%2===0) dark=!dark; // Mask pattern 0
          m[y][x]=dark;
        }
      }
      upward=!upward;
    }
    return m;
  }

  function toCanvas(canvas,text,opts={}){
    if(!canvas || !canvas.getContext) throw new Error("Canvas inválido para QR Code.");
    const matrix=makeMatrix(text);
    const quiet=4;
    const requested=Number(opts.width||260);
    const scale=Math.max(1,Math.floor(requested/(SIZE+quiet*2)));
    const px=(SIZE+quiet*2)*scale;
    canvas.width=px; canvas.height=px;
    canvas.style.width=`${Math.min(requested,px)}px`;
    canvas.style.height=`${Math.min(requested,px)}px`;
    const ctx=canvas.getContext("2d");
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=opts.colorLight||"#ffffff"; ctx.fillRect(0,0,px,px);
    ctx.fillStyle=opts.colorDark||"#073B73";
    for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) if(matrix[y][x]){
      ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);
    }
    return canvas;
  }

  global.SafetyQR={toCanvas,makeMatrix,version:VERSION,maxBytes:MAX_BYTES};
})(window);
