function trustedSender(event, windows, appUrl) {
  return windows.some(
    (win) =>
      !win.isDestroyed() &&
      event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame &&
      event.senderFrame?.url === appUrl,
  )
}
function externalUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
module.exports = { trustedSender, externalUrl }
