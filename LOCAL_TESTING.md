# Test cutiepynb locally

You do not need to install the Python package to test the webpage.

## 1. Unzip and open a terminal

Unzip the repository, open Terminal, and move into the unzipped `cutiepynb`
folder. On macOS, you can type `cd `, drag the folder into the Terminal window,
and press Return.

## 2. Start a small local web server

```bash
python3 -m http.server 8000
```

If `python3` is not recognized on Windows, try:

```powershell
py -m http.server 8000
```

Keep that terminal window open while testing.

## 3. Open the studio

Visit <http://localhost:8000/web/> in Chrome, Firefox, Safari, or Edge.

Do not double-click `web/index.html`. Browsers block the local file requests
that the app needs when it is opened with a `file://` address.

## 4. Suggested test

1. Select **Try the demo**.
2. Change a palette and one individual heading color.
3. Open **Edit the outline**, correct one title, and change its H1–H6 level.
4. Rename or disable the table of contents.
5. Select **Prepare & download notebook**.
6. Open the downloaded `_chulo.ipynb` file in Jupyter.
7. Upload that downloaded file again, choose another palette, and download it.
   The old colors, anchors, and table of contents should be replaced rather
   than duplicated.
8. Repeat with one of your own notebooks.

The formatter is native JavaScript, so there is no Python runtime or CDN bundle
to wait for. The notebook itself is not uploaded, and its code is not executed.

## Stop the server

Return to the terminal and press `Ctrl+C`.

## Optional developer checks

```bash
python3 -m pip install -e ".[dev]"
pytest
cd web
npm test
```
