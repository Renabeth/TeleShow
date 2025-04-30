@echo About To Build Flask App 
@echo This process could take 3-4 minutes
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
if exist "build\*.png" (
    copy "build\*.png" "backend\app\static\" /Y
)

echo Checking if static folder has files...
dir /b "backend\app\static\" 2>nul | findstr "." >nul
if errorlevel 1 (
    echo Static folder is empty or contains no files. Executable build skipped.
    pause
) else (
    echo Static folder has files. Building executable...
    cd backend
    
    echo Running PyInstaller... Please wait...
    
    pyinstaller --onefile ^
       --icon=favicon.ico ^
       --add-data "app/Resources;app/Resources" ^
       --add-data ".env;." ^
       --add-data "app/static;app/static" ^
       --add-data "app/templates;app/templates" ^
       --hidden-import="app.blueprints.search" ^
       --hidden-import="app.blueprints.recommendations" ^
       --hidden-import="app.blueprints.interactions" ^
       teleshow.py
    
    if errorlevel 1 (
        echo PyInstaller command failed. Please check for errors above.
        pause
    ) else (
        echo PyInstaller completed successfully.
        
        echo Opening dist folder...
        if exist "dist" (
            explorer dist
        ) else (
            echo Error: dist folder not found
        )
    )
    
    cd ..
)

@echo ===== Build complete! =====
@pause