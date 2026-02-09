; -- Example1.iss --
; Demonstrates copying 3 files and creating an icon.

; SEE THE DOCUMENTATION FOR DETAILS ON CREATING .ISS SCRIPT FILES!

[Setup]
AppName=MatMak Solutions Precut
AppVersion=3.2.25060003
WizardStyle=modern
PrivilegesRequired=lowest
DefaultDirName={autopf}\Matmak
DefaultGroupName=MatmakSolutions
UninstallDisplayIcon={app}\matmak-precut.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.\setup
DisableStartupPrompt=True
DisableWelcomePage=False
DisableDirPage=True
VersionInfoVersion=3.1
VersionInfoCompany=Matmak Solutions
OutputBaseFilename=MatmakSetup-3.2.25060003

[Files]
Source: "..\out\mm-ui-win32-x64\matmak-precut.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\LICENSES.chromium.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\resources.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\snapshot_blob.bin"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\v8_context_snapshot.bin"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\version"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\vk_swiftshader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\vk_swiftshader_icd.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\vulkan-1.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\chrome_100_percent.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\chrome_200_percent.pak"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\d3dcompiler_47.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\ffmpeg.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\icudtl.dat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\libEGL.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\libGLESv2.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\out\mm-ui-win32-x64\conf\*"; DestDir: "{app}\conf"; Flags: ignoreversion createallsubdirs recursesubdirs
Source: "..\out\mm-ui-win32-x64\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion createallsubdirs recursesubdirs
Source: "..\out\mm-ui-win32-x64\locales\*"; DestDir: "{app}\locales"; Flags: ignoreversion createallsubdirs recursesubdirs
Source: "..\out\mm-ui-win32-x64\sdk\*"; DestDir: "{app}\sdk"; Flags: ignoreversion createallsubdirs recursesubdirs

[Icons]
Name: "{autodesktop}\MatmakPrecut"; Filename: "{app}\matmak-precut.exe"

;[Run]
;Filename: "{app}\matmak-precut.exe"

