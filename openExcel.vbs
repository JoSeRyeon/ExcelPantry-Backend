' openExcel.vbs
Option Explicit

Dim excel, wb, filePath, sheetName, cellAddress, found, w

Set excel = Nothing
On Error Resume Next
Set excel = GetObject(, "Excel.Application")
If Err.Number <> 0 Then
    Err.Clear
    Set excel = CreateObject("Excel.Application")
End If
On Error Goto 0

excel.Visible = True

filePath = WScript.Arguments(0)
sheetName = WScript.Arguments(1)
cellAddress = WScript.Arguments(2)

found = False
For Each w In excel.Workbooks
    If LCase(w.FullName) = LCase(filePath) Then
        Set wb = w
        found = True
        Exit For
    End If
Next

If Not found Then
    Set wb = excel.Workbooks.Open(filePath, False, False) ' 읽기 전용 아님
End If

wb.Sheets(sheetName).Activate
wb.Sheets(sheetName).Range(cellAddress).Select
