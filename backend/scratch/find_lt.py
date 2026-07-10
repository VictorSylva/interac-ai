import os
import re

def find_less_than_comparisons(directory):
    # Regex for something < something_else
    # We avoid imports, HTML tags, and comments if possible
    pattern = re.compile(r'[^=!<>\s]\s*<\s*[^=!<>\s]')
    
    for root, dirs, files in os.walk(directory):
        if 'venv' in dirs: dirs.remove('venv')
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '__pycache__' in dirs: dirs.remove('__pycache__')
        
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    try:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            if '<' in line and '#' not in line:
                                # Simple check for int < NoneType possibility
                                print(f"{path}:{i+1}: {line.strip()}")
                    except:
                        pass

if __name__ == "__main__":
    find_less_than_comparisons('.')
