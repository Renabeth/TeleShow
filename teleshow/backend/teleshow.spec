# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['teleshow.py'],
    pathex=[],
    binaries=[],
    datas=[('app/Resources', 'app/Resources'), ('.env', '.'), ('app/static', 'app/static'), ('app/templates', 'app/templates')],
    hiddenimports=['app.blueprints.search', 'app.blueprints.recommendations', 'app.blueprints.interactions'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='teleshow',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['favicon.ico'],
)
