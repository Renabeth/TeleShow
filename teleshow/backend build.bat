@echo About To Build Flask App 
@pause

@echo ===== Building =====

@echo off
echo Checking build folder...

if not exist "build" mkdir build

dir /b /s /a "build\" | findstr .>nul || (
    echo Build folder is empty, running npm build...
    npm run build
)

if not exist "backend\app\static" mkdir backend\app\static

echo Moving static assets...
if exist "build\static" (
    xcopy "build\static\*" "backend\app\static\" /E /Y
)

echo Moving index.html and other files...
if exist "build\index.html" (
    copy "build\index.html" "backend\app\static\" /Y
)
if exist "build\*.json" (
    copy "build\*.json" "backend\app\static\" /Y
)
if exist "build\*.ico" (
    copy "build\*.ico" "backend\app\static\" /Y
)

echo Building executable with PyInstaller...
cd backend
pyinstaller --onefile `
   --icon=favicon.ico `
   --add-data "app/Resources;app/Resources" `
   --add-data ".env;." `
   --add-data "app/static;app/static" `
   --add-data "app/templates;app/templates" `
   --hidden-import="app.blueprints.search" `
   --hidden-import="app.blueprints.recommendations" `
   --hidden-import="app.blueprints.interactions" `
   teleshow.py

echo Opening dist folder...
if exist "dist" (
    explorer dist
) else (
    echo Error: dist folder not found
)

cd ..

@echo ===== Build complete! =====
@pause