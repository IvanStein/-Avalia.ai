import os

file_path = r'd:\prog\Avalia.ai\app\page.tsx'

with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    for i, line in enumerate(f):
        if "view ===" in line:
            print(f"{i+1}: {line.strip()}")
