Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\ACER\Desktop\Lua"
WshShell.Run "cmd /c ""set NODE_TLS_REJECT_UNAUTHORIZED=0 && node index.js""", 0, False
