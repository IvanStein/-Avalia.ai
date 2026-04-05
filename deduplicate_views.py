import os
import re

file_path = r'd:\prog\Avalia.ai\app\page.tsx'

with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()

# Pattern for view blocks: {view === '...' && ( ... )} or {view === '...' && <> ... </>}
# We need to find where each one starts and ends.
# I'll just look for {view === '...' and try to find the balancing brace.

view_names = ['dashboard', 'subjects', 'students', 'enrollment', 'activities', 'batch', 'copy', 'reports', 'implementacoes', 'settings']

found_blocks = []

for vn in view_names:
    pattern = r"\{view === '" + vn + r"' &&"
    for match in re.finditer(pattern, text):
        start_pos = match.start()
        # Find balancing brace
        brace_count = 0
        end_pos = -1
        # Start looking after the '&&' and potentially space/open paren/fragment
        # We look for the first '{' and balance it.
        # Wait, the block starts with '{' (at match.start())
        for i in range(start_pos, len(text)):
            if text[i] == '{': brace_count += 1
            if text[i] == '}': brace_count -= 1
            if brace_count == 0:
                end_pos = i + 1
                break
        if end_pos != -1:
            found_blocks.append({'name': vn, 'start': start_pos, 'end': end_pos})

# Sort by start position
found_blocks.sort(key=lambda x: x['start'])

# We want to keep ONLY ONE for each view name. 
# Which one? PROBABLY THE ONE THAT IS RICHEST OR WAS LAST EDITED.
# Usually, duplication happens at the end.
# I'll keep the ones that appear LATEST in the file but BEFORE the final part where implementacoes/settings are.
# Wait, let's look at the implementation names.
# implementacoes and settings only appear once.

keepers = {}
for blk in found_blocks:
    keepers[blk['name']] = blk # Always overwrite with the latest one

# Now construct the new file.
# Keep everything before the first block.
# Then put all keepers in order.
# Then everything after the last block.

if found_blocks:
    prefix = text[:found_blocks[0]['start']]
    suffix = text[found_blocks[-1]['end']:] # This is a bit risky if settings was not the last.
    
    # Actually, let's keep the file structure but remove the non-keepers.
    # Start after the last part of prefix.
    
    # Better: Identify all blocks we want to REMOVE.
    to_remove = []
    kept_starts = set(k['start'] for k in keepers.values())
    for blk in found_blocks:
        if blk['start'] not in kept_starts:
            to_remove.append(blk)
    
    # Sort removals by start descending to avoid index shift
    to_remove.sort(key=lambda x: x['start'], reverse=True)
    
    new_text = text
    for blk in to_remove:
        new_text = new_text[:blk['start']] + "        \n" + new_text[blk['end']:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print(f"Successfully removed {len(to_remove)} duplicated blocks.")
    for blk in to_remove:
        print(f"Removed duplicate: {blk['name']} at offset {blk['start']}")
else:
    print("No blocks found.")
