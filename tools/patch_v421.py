from pathlib import Path

idx=Path('index.html'); jsf=Path('script.js'); cssf=Path('style.css')
index=idx.read_text(encoding='utf-8'); js=jsf.read_text(encoding='utf-8'); css=cssf.read_text(encoding='utf-8')

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit('MISSING '+label)
    return text.replace(old,new,1)

index=index.replace('style.css?v=4.2.0','style.css?v=4.2.1',1)
index=index.replace('script.js?v=4.2.0','script.js?v=4.2.1',1)
index=index.replace('ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.2.0 |','ระบบบริหารจัดการยืมคืนอุปกรณ์การแพทย์ v4.2.1 |',1)
js=js.replace('Frontend Controller API (v4.2.0 LINE Rich Menu Manager)','Frontend Controller API (v4.2.1 Rich Menu Publish Button Hotfix)',1)

old='''<button id="line-rm-create-btn" type="button" onclick="createLineRichMenuFromUi()" class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> สร้าง + อัปโหลด + Publish Rich Menu</button>'''
new='''<button id="line-rm-create-btn" type="button" onclick="createLineRichMenuFromUi()" class="line-rm-publish-btn mt-4 w-full px-4 py-3 rounded-xl text-xs font-bold shadow-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> สร้าง + อัปโหลด + Publish Rich Menu</button>'''
index=rep(index,old,new,'publish button')

patch='''\n/* ---------- v4.2.1 Rich Menu publish button visibility hotfix ---------- */\n#line-rm-create-btn.line-rm-publish-btn{\n  display:flex !important;\n  align-items:center !important;\n  justify-content:center !important;\n  width:100% !important;\n  min-height:48px !important;\n  background:#059669 !important;\n  color:#ffffff !important;\n  border:1px solid #047857 !important;\n  border-radius:12px !important;\n  cursor:pointer !important;\n  pointer-events:auto !important;\n  visibility:visible !important;\n  opacity:1 !important;\n  position:relative;\n  z-index:2;\n  box-shadow:0 8px 18px -8px rgba(5,150,105,.55) !important;\n}\n#line-rm-create-btn.line-rm-publish-btn:hover{ background:#047857 !important; }\n#line-rm-create-btn.line-rm-publish-btn:active{ background:#065f46 !important; transform:translateY(1px); }\n#line-rm-create-btn.line-rm-publish-btn:focus-visible{ outline:3px solid rgba(16,185,129,.28) !important; outline-offset:2px; }\nhtml[data-theme="dark"] #line-rm-create-btn.line-rm-publish-btn{ background:#059669 !important; color:#fff !important; border-color:#34d399 !important; }\n'''
if 'v4.2.1 Rich Menu publish button visibility hotfix' not in css:
    css=css.rstrip()+patch+'\n'

for p,text in [(idx,index),(jsf,js),(cssf,css)]:
    p.write_text('\n'.join(line.rstrip() for line in text.splitlines())+'\n',encoding='utf-8')
print('patched v4.2.1')
