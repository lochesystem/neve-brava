import "./design-system.css";
import "./catalog.css";
const palette=[['ink','Tinta'],['paper','Papel'],['snow','Neve'],['ice','Gelo'],['pine','Pinho'],['gold','Ouro'],['coral','Coral'],['wood','Madeira']];
const container=document.querySelector('#swatches')!;
for(const [token,label] of palette) {
  const card=document.createElement('div');card.className='swatch';
  const chip=document.createElement('div');chip.style.background=`var(--sr-${token})`;chip.setAttribute('aria-hidden','true');
  const name=document.createElement('b');name.textContent=label;
  const code=document.createElement('code');code.textContent=`--sr-${token}`;
  card.append(chip,name,code);container.append(card);
}
document.querySelectorAll<HTMLButtonElement>('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelector('#demo-feedback')!.textContent=`“${button.textContent?.trim()}” acionado. Demonstração de interação — nenhuma partida iniciada.`;
}));
