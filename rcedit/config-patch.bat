@echo off

rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-icon ..\assets\matmak.ico
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-file-version "3.250600.0.0"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-product-version "3.2"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "CompanyName" "Matmak"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "FileDescription" "Precut optimization software"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "FileVersion" "3.2.0"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "InternalName" "Matmak Precut"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "OriginalFilename" "Matmak-Precut"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "ProductName" "Matmak Precut2
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "ProductVersion" "3.2.0"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "Assembly Version" "3.2.0"
rcedit ..\out\mm-ui-win32-x64\matmak-precut.exe --set-version-string "LegalCopyright" "Matmak Solutions"


echo Patch Done !
