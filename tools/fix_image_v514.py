from pathlib import Path

p=Path('script.js')
s=p.read_text(encoding='utf-8')
s=s.replace('v5.1.3 Supabase Health Monitoring','v5.1.4 Secure Image Refresh',1)
anchor='const borrowImageCache = new Map();'
if 'BORROW_IMAGE_CACHE_TTL_MS' not in s:
    s=s.replace(anchor, anchor+'\nconst BORROW_IMAGE_CACHE_TTL_MS = 8 * 60 * 1000; // signed URL มีอายุ 10 นาที จึง refresh ก่อนหมดอายุ',1)
old="""async function getBorrowImageDataUrl(value){
    const id=normalizeBorrowImageId(value);
    if(!id)return '';
    if(borrowImageCache.has(id))return borrowImageCache.get(id);
    const r=await run('getBorrowImage',{fileId:id});
    if(!r||!r.success||!r.dataUrl){
        const msg=(r&&r.error)?String(r.error):'โหลดรูปหลักฐานไม่สำเร็จ';
        borrowImageErrorCache.set(id,msg);
        console.warn('โหลดรูปหลักฐานไม่สำเร็จ',{fileId:id,response:r});
        return '';
    }
    borrowImageErrorCache.delete(id);
    borrowImageCache.set(id,r.dataUrl);
    return r.dataUrl;
}"""
new="""async function getBorrowImageDataUrl(value, forceRefresh=false){
    const id=normalizeBorrowImageId(value);
    if(!id)return '';
    const cached=borrowImageCache.get(id);
    if(!forceRefresh && cached && cached.url && cached.expiresAt > Date.now()+15000) return cached.url;
    if(cached) borrowImageCache.delete(id);
    borrowImageErrorCache.delete(id);
    const r=await run('getBorrowImage',{fileId:id});
    if(!r||!r.success||!r.dataUrl){
        const msg=(r&&r.error)?String(r.error):'โหลดรูปหลักฐานไม่สำเร็จ';
        borrowImageErrorCache.set(id,msg);
        console.warn('โหลดรูปหลักฐานไม่สำเร็จ',{fileId:id,response:r});
        return '';
    }
    borrowImageErrorCache.delete(id);
    borrowImageCache.set(id,{url:r.dataUrl,expiresAt:Date.now()+BORROW_IMAGE_CACHE_TTL_MS});
    return r.dataUrl;
}"""
if old not in s:
    raise SystemExit('getBorrowImageDataUrl block not found')
s=s.replace(old,new,1)
old2="""        if(u){
            img.src=u;
            img.alt='รูปหลักฐานการยืม';
            img.title='';
            img.classList.remove('opacity-40','opacity-60');
            return;
        }"""
new2="""        if(u){
            img.dataset.secureImageRetried='0';
            img.onerror=async()=>{
                if(img.dataset.secureImageRetried==='1')return;
                img.dataset.secureImageRetried='1';
                borrowImageCache.delete(id);
                const fresh=await getBorrowImageDataUrl(id,true);
                if(fresh && fresh!==img.src) img.src=fresh;
            };
            img.src=u;
            img.alt='รูปหลักฐานการยืม';
            img.title='';
            img.classList.remove('opacity-40','opacity-60');
            return;
        }"""
if old2 not in s:
    raise SystemExit('hydrate image success block not found')
s=s.replace(old2,new2,1)
old3="""    const urls=await Promise.all(ids.map(getBorrowImageDataUrl)),valid=urls.filter(Boolean);
    if(!valid.length){body.innerHTML='<div class=\"col-span-full empty-state text-rose-500\">ไม่สามารถอ่านรูปหลักฐานได้ กรุณาตรวจสิทธิ์ไฟล์หรือ Supabase Storage</div>';return;}
    body.innerHTML=valid.map((url,i)=>`<div class=\"gallery-photo-item\"><img src=\"${url}\" data-secure-gallery-index=\"${i}\" alt=\"รูปหลักฐานการยืม\" /></div>`).join('');
    [...body.querySelectorAll('img[data-secure-gallery-index]')].forEach(img=>{img.onclick=()=>window.open(valid[Number(img.dataset.secureGalleryIndex)],'_blank');});"""
new3="""    const urls=await Promise.all(ids.map(id=>getBorrowImageDataUrl(id))),pairs=ids.map((id,i)=>({id,url:urls[i]})).filter(x=>!!x.url);
    if(!pairs.length){
        const errors=ids.map(id=>borrowImageErrorCache.get(normalizeBorrowImageId(id))).filter(Boolean);
        const detail=errors[0]||'กรุณาตรวจสิทธิ์ไฟล์หรือ Supabase Storage';
        body.innerHTML=`<div class=\"col-span-full empty-state text-rose-500\">ไม่สามารถอ่านรูปหลักฐานได้<br><span class=\"text-xs text-gray-500\">${escapeHtml(detail)}</span></div>`;return;
    }
    body.innerHTML=pairs.map((x,i)=>`<div class=\"gallery-photo-item\"><img src=\"${x.url}\" data-secure-gallery-index=\"${i}\" alt=\"รูปหลักฐานการยืม\" /></div>`).join('');
    [...body.querySelectorAll('img[data-secure-gallery-index]')].forEach(img=>{img.onclick=async()=>{const pair=pairs[Number(img.dataset.secureGalleryIndex)];const w=window.open('about:blank','_blank');const fresh=await getBorrowImageDataUrl(pair.id,true);if(fresh){if(w)w.location.href=fresh;else window.location.href=fresh;}else if(w)w.close();};});"""
if old3 not in s:
    raise SystemExit('gallery block not found')
s=s.replace(old3,new3,1)
p.write_text(s,encoding='utf-8')

i=Path('index.html')
h=i.read_text(encoding='utf-8').replace('script.js?v=5.1.3','script.js?v=5.1.4')
i.write_text(h,encoding='utf-8')
print('patched v5.1.4')
