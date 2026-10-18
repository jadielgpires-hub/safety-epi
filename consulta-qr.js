// RC10 — Leitura anônima EXCLUSIVA de qr_publico/{token}; demais coleções permanecem privadas.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {getFirestore,doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const config={apiKey:"AIzaSyDxHYAPM-1LthEfb-FA1_gTEv1A8uL5l3U",authDomain:"safety-epi.firebaseapp.com",projectId:"safety-epi",storageBucket:"safety-epi.firebasestorage.app",messagingSenderId:"450999995915",appId:"1:450999995915:web:5ef379ac2785e17a41410e"};
const db=getFirestore(initializeApp(config));
const $=id=>document.getElementById(id);
function show(id){for(const name of ["qr-loading","qr-error","qr-result"])$(name).hidden=name!==id;}
function dateBR(iso){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")))return "Não informada";const [y,m,d]=iso.split("-");return `${d}/${m}/${y}`;}
function timestampBR(v){const d=v?.toDate?.();return d?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(d):"Não informada";}
function row(label,value){const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=value||"Não informado";$("item-details").append(dt,dd);}
const token=new URLSearchParams(location.search).get("t")||"";
// Token de 192 bits, hexadecimal, 48 caracteres; proíbe IDs arbitrários e consultas de listagem.
if(!/^[0-9a-f]{48}$/.test(token)){show("qr-error");}
else {
  try{
    const snap=await getDoc(doc(db,"qr_publico",token));
    if(!snap.exists()||snap.data().ativo!==true)throw new Error("Registro indisponível");
    const x=snap.data();
    $("item-title").textContent=x.equipamento||"Equipamento";
    $("item-tag").textContent=`${x.codigoInterno||"Código não informado"} • TAG ${x.tag||"Não informada"}`;
    const uso=String(x.statusUso||"Verificar condição antes do uso");
    $("usage-badge").textContent=uso;
    $("usage-badge").classList.toggle("alert",/não liberado|verificar/i.test(uso));
    const rows=[["Tipo",x.tipo],["Fabricante",x.fabricante],["Modelo",x.modelo],["Número de série",x.numeroSerie],
      ["CA",x.ca],["Validade do CA",dateBR(x.validadeCA)],["Situação registrada",x.status],
      ["Última inspeção",dateBR(x.ultimaInspecao)],["Resultado da última inspeção",x.resultadoUltimaInspecao],["Próxima inspeção",dateBR(x.proximaInspecao)]];
    rows.forEach(([k,v])=>row(k,v));
    $("refresh-date").textContent=`Dados atualizados em: ${timestampBR(x.atualizadoEm)}`;
    show("qr-result");
  }catch(e){console.warn("Consulta QR:",e?.code||e?.message||e);show("qr-error");}
}
