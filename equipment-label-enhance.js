/* Phase 6.2.2 — stable dedicated label print copies for desktop/iPad */
(function(){
  function ensurePrintStack(){
    let stack=document.getElementById('printStack');
    if(!stack){stack=document.createElement('div');stack.id='printStack';stack.className='print-stack';document.body.appendChild(stack);}
    return stack;
  }
  function ensurePrintCss(){
    let style=document.getElementById('phase6LabelPrintCss');
    if(!style){style=document.createElement('style');style.id='phase6LabelPrintCss';document.head.appendChild(style);}
    return style;
  }
  function qrDataUrl(){
    const canvas=document.querySelector('#qr canvas');
    if(canvas&&typeof canvas.toDataURL==='function'){try{return canvas.toDataURL('image/png');}catch{}}
    const img=document.querySelector('#qr img');return img?.src||'';
  }
  function prepareClone(source,qrUrl,index){
    const clone=source.cloneNode(true);
    clone.id='label-print-'+index;
    clone.classList.add('print-label-copy');
    const qr=clone.querySelector('#qr');
    if(qr){qr.id='';if(qrUrl)qr.innerHTML=`<img src="${qrUrl}" alt="QR Code" style="width:22mm;height:22mm;display:block">`;}
    const barcode=clone.querySelector('#barcode');if(barcode)barcode.id='';
    ['brand','logo','agencyTitle','agencySub','eqName','eqCode','serial','qrWrap','barcodeWrap'].forEach(id=>{const el=clone.querySelector('#'+id);if(el)el.removeAttribute('id');});
    return clone;
  }
  window.printLabel=function(){
    applyPreview();
    const w=num('widthMm',90),h=num('heightMm',70),copies=Math.max(1,Math.min(20,num('copies',1)));
    const source=document.getElementById('label');if(!source||!payloadData)return;
    const stack=ensurePrintStack();stack.innerHTML='';
    const qrUrl=qrDataUrl();
    for(let i=0;i<copies;i++)stack.appendChild(prepareClone(source,qrUrl,i+1));
    const style=ensurePrintCss();
    style.textContent=`.print-stack{display:none}@media print{@page{size:${w}mm ${h}mm;margin:0}body{margin:0!important;background:#fff!important}.page{display:none!important}.print-stack{display:block!important}.print-stack .label{width:${w}mm!important;height:${h}mm!important;margin:0!important;border:0!important;box-shadow:none!important;page-break-after:always;break-after:page}.print-stack .label:last-child{page-break-after:auto;break-after:auto}}`;
    const status=document.getElementById('status');if(status)status.textContent=`พร้อมพิมพ์ ${copies} ใบ · ${w} × ${h} mm`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>window.print(),180)));
  };
  document.addEventListener('DOMContentLoaded',()=>{ensurePrintStack();ensurePrintCss();});
})();
