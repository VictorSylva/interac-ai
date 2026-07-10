import os
import re

def find_check_access_calls(directory):
    pattern = re.compile(r'check_access\((.*?)\)')
    for root, dirs, files in os.walk(directory):
        if 'venv' in dirs: dirs.remove('venv')
        if 'node_modules' in dirs: dirs.remove('node_modules')
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    matches = pattern.finditer(content)
                    for match in matches:
                        print(f"File: {path}, Call: {match.group(0)}")

if __name__ == "__main__":
    find_check_access_calls('.')
