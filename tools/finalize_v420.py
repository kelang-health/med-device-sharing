from pathlib import Path
import subprocess

subprocess.run(['python','tools/patch_v420.py'],check=True)
subprocess.run(['python','tools/fix_v420_literal_newlines.py'],check=True)
for name in ['index.html','script.js','style.css']:
    p=Path(name)
    text=p.read_text(encoding='utf-8').rstrip()+"\n"
    p.write_text(text,encoding='utf-8')
print('finalized v4.2.0 formatting')
