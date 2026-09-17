param([Parameter(Mandatory=$true)][string]$Keyword)

$ErrorActionPreference = 'Stop'
$baseUrl = 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/zh?industry=17&is_new_connect=0&is_new_user=0&period=180&region=SG%2CMY'
$tabs = Invoke-RestMethod 'http://127.0.0.1:9222/json'
$tab = $tabs | Where-Object type -eq 'page' | Select-Object -First 1
$ws = [Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
$script:seq = 0

function Invoke-Cdp([string]$Method,[hashtable]$Params=@{}) {
  $id = ++$script:seq
  $payload = @{id=$id;method=$Method;params=$Params} | ConvertTo-Json -Compress -Depth 8
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $ws.SendAsync([ArraySegment[byte]]$bytes,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  $buf = New-Object byte[] 400000
  do {
    $ms = [IO.MemoryStream]::new()
    do {
      $recv = $ws.ReceiveAsync([ArraySegment[byte]]$buf,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $ms.Write($buf,0,$recv.Count)
    } while(-not $recv.EndOfMessage)
    $msg = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
  } while($msg.id -ne $id)
  return $msg.result
}

Invoke-Cdp 'Page.navigate' @{url=$baseUrl} | Out-Null
Start-Sleep -Seconds 4
Invoke-Cdp 'Runtime.evaluate' @{expression='document.querySelectorAll("input")[1].focus()';returnByValue=$true} | Out-Null
Invoke-Cdp 'Input.dispatchKeyEvent' @{type='keyDown';key='a';code='KeyA';modifiers=2} | Out-Null
Invoke-Cdp 'Input.dispatchKeyEvent' @{type='keyUp';key='a';code='KeyA';modifiers=2} | Out-Null
Invoke-Cdp 'Input.insertText' @{text=$Keyword} | Out-Null
Invoke-Cdp 'Runtime.evaluate' @{expression='document.querySelector("[data-testid=cc_commonCom_autoComplete_seach]").click()';returnByValue=$true} | Out-Null
Start-Sleep -Seconds 6
$expr = '({keyword:document.querySelectorAll("input")[1].value,text:document.body.innerText.slice(0,14000),links:Array.from(document.querySelectorAll("a")).filter(a=>a.href.includes("/topads/")).map(a=>a.href)})'
$result = Invoke-Cdp 'Runtime.evaluate' @{expression=$expr;returnByValue=$true}
$result.result.value | ConvertTo-Json -Depth 6
