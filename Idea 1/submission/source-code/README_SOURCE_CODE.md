# Source Code Folder Instructions

For the final flash drive, copy the actual project files into this `source-code` folder.

Required files and folders:

```text
index.html
app.js
styles.css
theme.css
favicon.svg
requirements.txt
README.md
data/
docs/
scripts/
tests/
```

Recommended command from the project root:

```powershell
robocopy . submission\source-code index.html app.js styles.css theme.css favicon.svg requirements.txt README.md
robocopy data submission\source-code\data /E
robocopy docs submission\source-code\docs /E
robocopy scripts submission\source-code\scripts /E /XD __pycache__
robocopy tests submission\source-code\tests /E /XD __pycache__
```

Before defence, confirm the copied app runs from `source-code/`:

```powershell
cd submission\source-code
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

